"use server";

import { db } from "./db";
import { LeadActivityType, LeadSource, LeadStage } from "./prisma-enums";
import { requireRole, requireUser } from "./session";
import { revalidatePath } from "next/cache";

type InstagramSheetLeadPayload = {
  atmId: string | null;
  name: string;
  phone: string | null;
  city: string | null;
  language: string | null;
  address: string | null;
  ownershipType: string | null;
  stage: LeadStage;
  notes: string | null;
  nextFollowUpAt: Date | null;
  lastContactedAt: Date | null;
};

function cleanToken(token: string | null | undefined) {
  return token ? token.replace(/^['"]|['"]$/g, "").trim() : "";
}

function buildAppsScriptUrl(appScriptUrl: string, secretToken: string | null) {
  const url = new URL(appScriptUrl);
  const key = cleanToken(secretToken);

  if (key) {
    url.searchParams.set("key", key);
  }

  return url.toString();
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function syncInstagramLeadBackToSheet(lead: InstagramSheetLeadPayload) {
  if (!lead.atmId) {
    return "Instagram sheet sync skipped because the lead has no ATM-ID.";
  }

  const integration = await db.leadIntegration.findUnique({
    where: { source: LeadSource.INSTAGRAM },
  });

  if (!integration?.appScriptUrl || !integration.spreadsheetId || !integration.sheetName) {
    return "Instagram details saved in CRM, but sheet sync is not configured.";
  }

  try {
    const response = await fetch(
      buildAppsScriptUrl(integration.appScriptUrl, integration.secretToken),
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "updateInstagramLead",
          sheetId: integration.spreadsheetId,
          sheetName: integration.sheetName,
          lead: {
            atmId: lead.atmId,
            name: lead.name,
            phone: lead.phone,
            city: lead.city,
            language: lead.language,
            address: lead.address,
            ownershipType: lead.ownershipType,
            stage: lead.stage,
            notes: lead.notes,
            nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
            lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
          },
        }),
      },
    );

    if (!response.ok) {
      return `Instagram details saved in CRM, but Apps Script returned HTTP ${response.status}.`;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      updated?: boolean;
      error?: string;
    };

    if (payload.ok === false) {
      return `Instagram details saved in CRM, but sheet update failed: ${payload.error || "Apps Script error"}.`;
    }

    if (payload.updated !== true) {
      return "Instagram details saved in CRM, but sheet update was not confirmed. Redeploy the latest Apps Script code from CRM settings.";
    }

    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Apps Script error";
    return `Instagram details saved in CRM, but sheet update failed: ${message}.`;
  }
}

/**
 * Bulk assign Website or Instagram leads to an agent (Admin only).
 */
export async function adminAssignLeadsAction(
  leadIds: string[],
  source: LeadSource,
  agentId: string | null
) {
  try {
    const admin = await requireRole("ADMIN");

    if (!leadIds || leadIds.length === 0) {
      return { error: "No leads selected for assignment." };
    }

    let agentName = "unassigned";
    if (agentId) {
      const agent = await db.user.findUnique({ where: { id: agentId } });
      if (!agent) {
        return { error: "Selected agent does not exist." };
      }
      agentName = agent.username;
    }

    const description = agentId
      ? `Lead assigned to agent ${agentName}`
      : "Lead unassigned";

    if (source === LeadSource.WEBSITE) {
      await db.websiteLead.updateMany({
        where: { id: { in: leadIds } },
        data: { assignedToId: agentId },
      });

      // Log activities in bulk
      const activities = leadIds.map((leadId) => ({
        actionType: "ASSIGNMENT_CHANGE" as LeadActivityType,
        description,
        userId: admin.id,
        websiteLeadId: leadId,
      }));

      await db.leadActivity.createMany({ data: activities });
    } else {
      await db.instagramLead.updateMany({
        where: { id: { in: leadIds } },
        data: { assignedToId: agentId },
      });

      // Log activities in bulk
      const activities = leadIds.map((leadId) => ({
        actionType: "ASSIGNMENT_CHANGE" as LeadActivityType,
        description,
        userId: admin.id,
        instagramLeadId: leadId,
      }));

      await db.leadActivity.createMany({ data: activities });
    }

    revalidatePath("/admin/leads");
    revalidatePath("/user/leads");

    return { success: true };
  } catch (error) {
    console.error("Error in adminAssignLeadsAction:", error);
    return { error: getErrorMessage(error, "An unexpected error occurred during lead assignment.") };
  }
}

/**
 * Mark selected unassigned new leads as read so historical imports stop
 * cluttering the New Leads queue without changing their pipeline stage.
 */
export async function adminMarkLeadsReadAction(
  leadIds: string[],
  source: LeadSource
) {
  try {
    const admin = await requireRole("ADMIN");

    if (!leadIds || leadIds.length === 0) {
      return { error: "No leads selected." };
    }

    const readAt = new Date();

    if (source === LeadSource.WEBSITE) {
      await db.websiteLead.updateMany({
        where: { id: { in: leadIds } },
        data: { readAt },
      });

      await db.leadActivity.createMany({
        data: leadIds.map((leadId) => ({
          actionType: "NOTE_ADDED" as LeadActivityType,
          description: "Lead marked as read in new lead queue",
          userId: admin.id,
          websiteLeadId: leadId,
        })),
      });
    } else {
      await db.instagramLead.updateMany({
        where: { id: { in: leadIds } },
        data: { readAt },
      });

      await db.leadActivity.createMany({
        data: leadIds.map((leadId) => ({
          actionType: "NOTE_ADDED" as LeadActivityType,
          description: "Lead marked as read in new lead queue",
          userId: admin.id,
          instagramLeadId: leadId,
        })),
      });
    }

    revalidatePath("/admin/leads");
    revalidatePath("/admin/leads/new");

    return { success: true };
  } catch (error) {
    console.error("Error in adminMarkLeadsReadAction:", error);
    return { error: getErrorMessage(error, "An unexpected error occurred while marking leads as read.") };
  }
}

/**
 * Permanently delete selected CRM leads. This does not delete rows from Google Sheets.
 */
export async function adminDeleteLeadsAction(
  leadIds: string[],
  source: LeadSource
) {
  try {
    await requireRole("ADMIN");

    if (!leadIds || leadIds.length === 0) {
      return { error: "No leads selected." };
    }

    if (source === LeadSource.WEBSITE) {
      await db.websiteLead.deleteMany({
        where: { id: { in: leadIds } },
      });
    } else {
      await db.instagramLead.deleteMany({
        where: { id: { in: leadIds } },
      });
    }

    revalidatePath("/admin/leads");
    revalidatePath("/admin/leads/new");
    revalidatePath("/admin/leads/assigned");
    revalidatePath("/admin/leads/follow-ups");
    revalidatePath("/user/leads");
    revalidatePath("/user/leads/follow-ups");

    return { success: true };
  } catch (error) {
    console.error("Error in adminDeleteLeadsAction:", error);
    return { error: getErrorMessage(error, "An unexpected error occurred while deleting leads.") };
  }
}

/**
 * Update lead workflow: stage, notes, and next follow-up.
 * Accessible by Admins or the Agent assigned to the lead.
 */
export async function updateLeadWorkflowAction(
  leadId: string,
  source: LeadSource,
  data: {
    stage: LeadStage;
    notes?: string;
    nextFollowUpAt?: string; // ISO string
  }
) {
  try {
    const user = await requireUser();

    // 1. Fetch the lead to verify existence and check security boundaries
    let lead;
    if (source === LeadSource.WEBSITE) {
      lead = await db.websiteLead.findUnique({ where: { id: leadId } });
    } else {
      lead = await db.instagramLead.findUnique({ where: { id: leadId } });
    }

    if (!lead) {
      return { error: "Lead not found." };
    }

    // 2. Strict Security Boundary: Agents can only update leads assigned to them.
    if (user.role !== "ADMIN" && lead.assignedToId !== user.id) {
      return { error: "Unauthorized. You can only update leads assigned to you." };
    }

    const stageChanged = lead.stage !== data.stage;
    const notesChanged = data.notes && lead.notes !== data.notes;

    let parsedFollowUp: Date | null = null;
    if (data.nextFollowUpAt) {
      const parsedDate = new Date(data.nextFollowUpAt);
      if (!isNaN(parsedDate.getTime())) {
        parsedFollowUp = parsedDate;
      }
    }

    const oldFollowUpTime = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).getTime() : null;
    const newFollowUpTime = parsedFollowUp ? parsedFollowUp.getTime() : null;
    const followUpChanged = oldFollowUpTime !== newFollowUpTime;

    // 3. Perform Update
    const updatePayload = {
      stage: data.stage,
      notes: data.notes || lead.notes,
      nextFollowUpAt: parsedFollowUp,
      lastContactedAt: new Date(),
    };

    let sheetSyncWarning: string | null = null;

    if (source === LeadSource.WEBSITE) {
      await db.websiteLead.update({
        where: { id: leadId },
        data: updatePayload,
      });
    } else {
      const updatedLead = await db.instagramLead.update({
        where: { id: leadId },
        data: updatePayload,
      });

      sheetSyncWarning = await syncInstagramLeadBackToSheet(updatedLead);
    }

    // 4. Log Activities
    const activitiesToCreate = [];

    if (stageChanged) {
      activitiesToCreate.push({
        actionType: "STAGE_CHANGE" as LeadActivityType,
        description: `Stage updated from ${lead.stage} to ${data.stage}`,
        userId: user.id,
        websiteLeadId: source === LeadSource.WEBSITE ? leadId : null,
        instagramLeadId: source === LeadSource.INSTAGRAM ? leadId : null,
      });
    }

    if (notesChanged) {
      activitiesToCreate.push({
        actionType: "NOTE_ADDED" as LeadActivityType,
        description: `Note added: "${data.notes}"`,
        userId: user.id,
        websiteLeadId: source === LeadSource.WEBSITE ? leadId : null,
        instagramLeadId: source === LeadSource.INSTAGRAM ? leadId : null,
      });
    }

    if (followUpChanged) {
      const followUpDesc = parsedFollowUp
        ? `Follow-up scheduled for ${parsedFollowUp.toLocaleString("en-IN")}`
        : "Follow-up schedule cleared";
      activitiesToCreate.push({
        actionType: "FOLLOW_UP_UPDATE" as LeadActivityType,
        description: followUpDesc,
        userId: user.id,
        websiteLeadId: source === LeadSource.WEBSITE ? leadId : null,
        instagramLeadId: source === LeadSource.INSTAGRAM ? leadId : null,
      });
    }

    if (activitiesToCreate.length > 0) {
      await db.leadActivity.createMany({ data: activitiesToCreate });
    }

    revalidatePath("/admin/leads");
    revalidatePath("/user/leads");

    return { success: true, warning: sheetSyncWarning };
  } catch (error) {
    console.error("Error in updateLeadWorkflowAction:", error);
    return { error: getErrorMessage(error, "An unexpected error occurred while updating the lead workflow.") };
  }
}

/**
 * Update editable customer details after an agent call.
 * Admins can update any lead; agents can only update leads assigned to them.
 */
export async function updateLeadDetailsAction(
  leadId: string,
  source: LeadSource,
  data: {
    name: string;
    phone?: string;
    city?: string;
    language?: string;
    address?: string;
    ownershipType?: string;
  }
) {
  try {
    const user = await requireUser();

    const lead = source === LeadSource.WEBSITE
      ? await db.websiteLead.findUnique({ where: { id: leadId } })
      : await db.instagramLead.findUnique({ where: { id: leadId } });

    if (!lead) {
      return { error: "Lead not found." };
    }

    if (user.role !== "ADMIN" && lead.assignedToId !== user.id) {
      return { error: "Unauthorized. You can only edit leads assigned to you." };
    }

    const updatePayload = {
      name: data.name.trim() || lead.name,
      phone: data.phone?.trim() || null,
      city: data.city?.trim() || null,
      language: data.language?.trim() || null,
      address: data.address?.trim() || null,
      ownershipType: data.ownershipType?.trim() || null,
      lastContactedAt: new Date(),
    };

    let sheetSyncWarning: string | null = null;

    if (source === LeadSource.WEBSITE) {
      await db.websiteLead.update({
        where: { id: leadId },
        data: updatePayload,
      });
    } else {
      const updatedLead = await db.instagramLead.update({
        where: { id: leadId },
        data: updatePayload,
      });

      sheetSyncWarning = await syncInstagramLeadBackToSheet(updatedLead);
    }

    await db.leadActivity.create({
      data: {
        actionType: "NOTE_ADDED",
        description: "Lead contact details updated after call",
        userId: user.id,
        websiteLeadId: source === LeadSource.WEBSITE ? leadId : null,
        instagramLeadId: source === LeadSource.INSTAGRAM ? leadId : null,
      },
    });

    revalidatePath("/admin/leads");
    revalidatePath("/user/leads");
    revalidatePath("/user/leads/follow-ups");
    revalidatePath("/admin/leads/follow-ups");

    return { success: true, warning: sheetSyncWarning };
  } catch (error) {
    console.error("Error in updateLeadDetailsAction:", error);
    return { error: getErrorMessage(error, "An unexpected error occurred while updating lead details.") };
  }
}
