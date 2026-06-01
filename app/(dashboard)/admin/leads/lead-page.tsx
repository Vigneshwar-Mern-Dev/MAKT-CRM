"use client";

import { useMemo, useState, useTransition } from "react";
import { adminAssignLeadsAction, adminDeleteLeadsAction, adminMarkLeadsReadAction, updateLeadDetailsAction, updateLeadWorkflowAction } from "@/app/lib/lead-actions";
import { syncAllLeadsFromModalAction } from "@/app/lib/lead-integration-actions";
import { LeadSource, LeadStage } from "@/app/lib/prisma-enums";
import { useRouter } from "next/navigation";

// Define the shape of our hydrated lead row
export type LeadRow = {
  id: string;
  atmId: string | null;
  timestamp: Date | string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  ownershipType: string | null;
  provider: string | null;
  language: string | null;
  message: string | null;
  sheetSource: string | null;
  stage: LeadStage;
  assignedToId: string | null;
  lastContactedAt: Date | string | null;
  nextFollowUpAt: Date | string | null;
  notes: string | null;
  readAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  assignedTo?: { id: string; username: string; email: string; department?: string } | null;
  activities?: Array<{
    id: string;
    actionType: string;
    description: string;
    createdAt: Date | string;
    user?: { username: string } | null;
  }>;
};

type LeadPageProps = {
  title: string;
  description: string;
  stageLabel: string;
  leads: LeadRow[];
  agents?: Array<{ id: string; username: string; email: string; department?: string }>;
  isAdmin: boolean;
  selectedSource: LeadSource;
  sourceOptions?: Array<{
    label: string;
    value: string;
  }>;
  showSourceStatus?: boolean;
  showMarkReadAction?: boolean;
  sourceStatusError?: string | null;
  sourceStatuses?: Array<{
    failedCount: number;
    importedCount: number;
    lastSyncedAt: Date | null;
    lastTestedAt?: Date | null;
    lastError?: string | null;
    source: string;
    status: string;
    title: string;
    tone: string;
    secretToken?: string | null;
    sheetName?: string | null;
    spreadsheetId?: string | null;
  }>;
  actionPath?: string;
};

const DEFAULT_CRM_URL = "https://makt-crm.vercel.app";
const CRM_ORIGIN = (process.env.NEXT_PUBLIC_CRM_URL || DEFAULT_CRM_URL).replace(/\/+$/, "");
const SYNC_LEAD_WEBHOOK_URL = `${CRM_ORIGIN}/api/sync-lead`;

function formatLeadDate(
  lead: Pick<LeadRow, "createdAt" | "timestamp">,
  source: LeadSource,
) {
  const dateValue = source === LeadSource.INSTAGRAM ? lead.createdAt : lead.timestamp;
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function LeadPage({
  title,
  description,
  stageLabel,
  leads = [],
  agents = [],
  isAdmin = false,
  selectedSource = LeadSource.WEBSITE,
  sourceOptions = [],
  showSourceStatus = false,
  showMarkReadAction = false,
  sourceStatusError = null,
  sourceStatuses = [],
  actionPath = "/admin/leads",
}: LeadPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAutoSyncModalOpen, setIsAutoSyncModalOpen] = useState(false);
  const [showSyncErrors, setShowSyncErrors] = useState(false);

  // Interactive modal visual/clipboard states
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // In-modal Sync states
  const [modalSyncing, setModalSyncing] = useState(false);
  const [modalSyncError, setModalSyncError] = useState<string | null>(null);
  const [modalSyncSuccess, setModalSyncSuccess] = useState<string | null>(null);

  const handleModalSync = async () => {
    setModalSyncError(null);
    setModalSyncSuccess(null);
    setModalSyncing(true);

    try {
      const res = await syncAllLeadsFromModalAction();
      const resultDetails = res.results
        .map((result) =>
          result.ok
            ? `${result.title}: imported ${result.importedCount}, failed ${result.failedCount}`
            : `${result.title}: ${result.error}`
        )
        .join(" | ");

      if (res.ok) {
        setModalSyncSuccess(
          `Successfully synced both sheets. Imported: ${res.importedCount}, Failed: ${res.failedCount || 0}. ${resultDetails}`
        );
        router.refresh();
      } else {
        setModalSyncError(`Partial sync. ${resultDetails}`);
        router.refresh();
      }
    } catch (err) {
      setModalSyncError(err instanceof Error ? err.message : "An unexpected error occurred during sync.");
    } finally {
      setModalSyncing(false);
    }
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>("ALL");
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Selection states
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkAgentId, setBulkAgentId] = useState<string>("");

  // Quick per-row assign state
  const [quickAssignLeadId, setQuickAssignLeadId] = useState<string | null>(null);
  const [quickAssignAgentId, setQuickAssignAgentId] = useState<string>("");

  // Action Panel (Modal/Sidebar) state
  const [activeLead, setActiveLead] = useState<LeadRow | null>(null);
  const [detailName, setDetailName] = useState("");
  const [detailPhone, setDetailPhone] = useState("");
  const [detailCity, setDetailCity] = useState("");
  const [detailLanguage, setDetailLanguage] = useState("");
  const [detailAddress, setDetailAddress] = useState("");
  const [detailOwnershipType, setDetailOwnershipType] = useState("");
  const [panelStage, setPanelStage] = useState<LeadStage>("NEW");
  const [panelNotes, setPanelNotes] = useState("");
  const [panelFollowUp, setPanelFollowUp] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Close status indicator
  const selectedSourceStatus = sourceStatuses.find(
    (source) => source.source === selectedSource
  );

  const websiteStatus = sourceStatuses.find((s) => s.source === "WEBSITE");
  const instagramStatus = sourceStatuses.find((s) => s.source === "INSTAGRAM");
  const websiteSheetName = websiteStatus?.sheetName || "Sheet1";
  const instagramSheetName = instagramStatus?.sheetName || "Sheet2";

  // Clean trailing/leading single or double quotes for safe presentation
  const displaySecretToken = selectedSourceStatus?.secretToken
    ? selectedSourceStatus.secretToken.replace(/^['"]|['"]$/g, "").trim()
    : "YOUR_SHARED_SECRET_TOKEN";

  const appsScriptCode = `/**
 * =========================================
 * CRM GOOGLE SHEETS SYNC API
 * Production Safer Version
 * =========================================
 */

const API_KEY = PropertiesService.getScriptProperties().getProperty("API_KEY") || "${displaySecretToken}";
const CRM_URL = stripTrailingSlashes(PropertiesService.getScriptProperties().getProperty("CRM_URL") || "${CRM_ORIGIN}");

const SHEET_SOURCE_MAP = {
  "${websiteSheetName}": "WEBSITE",
  "${instagramSheetName}": "INSTAGRAM"
};

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function stripTrailingSlashes(value) {
  let text = String(value || "");
  while (text.length > 1 && text.slice(-1) === "/") {
    text = text.slice(0, -1);
  }
  return text;
}

function doGet() {
  return json({ ok: true, service: "lead-sheet-api", time: new Date().toISOString() });
}

function normalizeHeaderName(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeaderIndex(headers, candidates) {
  const normalizedCandidates = candidates.map(normalizeHeaderName);
  for (let i = 0; i < headers.length; i++) {
    if (normalizedCandidates.indexOf(normalizeHeaderName(headers[i])) !== -1) {
      return i;
    }
  }
  return -1;
}

function ensureColumn(sheet, headers, candidates, label) {
  const existingIndex = findHeaderIndex(headers, candidates);
  if (existingIndex !== -1) {
    return existingIndex;
  }

  const newIndex = headers.length;
  sheet.getRange(1, newIndex + 1).setValue(label);
  headers.push(label);
  return newIndex;
}

function normalizePhone(value) {
  return String(value || "").replace(/\\D/g, "");
}

function buildFallbackAtmId(source, sheet, rowNumber, phone) {
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) {
    return source === "INSTAGRAM" ? "IG-" + normalizedPhone : "WEB-" + normalizedPhone;
  }
  return (source === "INSTAGRAM" ? "IG" : "WEB") + "-ROW-" + rowNumber;
}

function findInstagramLeadRow(sheet, headers, lead) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, Math.max(headers.length, 1)).getValues();
  const atmIndex = findHeaderIndex(headers, ["ATM-ID", "ATM ID", "atmId", "AtmId", "crmId"]);
  const phoneIndex = findHeaderIndex(headers, ["Phone", "phone", "Mobile", "mobile", "Mobile Number", "WhatsApp", "Number", "Contact"]);
  const targetAtmId = String(lead.atmId || "").trim();
  const targetOriginalPhone = normalizePhone(targetAtmId.replace(/^IG[-_ ]?/i, ""));

  for (let i = 0; i < values.length; i++) {
    const row = values[i];

    if (atmIndex !== -1 && String(row[atmIndex] || "").trim() === targetAtmId) {
      return i + 2;
    }

    if (phoneIndex !== -1 && targetOriginalPhone && normalizePhone(row[phoneIndex]) === targetOriginalPhone) {
      return i + 2;
    }
  }

  return null;
}

function updateInstagramLead(body) {
  const sheetId = (body.sheetId || "").trim();
  const sheetName = (body.sheetName || "").trim();
  const lead = body.lead || {};

  if (!sheetId || !sheetName) {
    return json({ ok: false, error: "sheetId and sheetName are required" });
  }

  if (!lead.atmId) {
    return json({ ok: false, error: "lead.atmId is required" });
  }

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) {
    return json({ ok: false, error: "Instagram sheet tab not found" });
  }

  const headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(h => String(h).trim());
  let rowNumber = findInstagramLeadRow(sh, headers, lead);

  const columns = {
    atmId: ensureColumn(sh, headers, ["ATM-ID", "ATM ID", "atmId", "AtmId", "crmId"], "ATM-ID"),
    name: ensureColumn(sh, headers, ["Name", "name", "Full Name", "Customer Name", "Instagram Name", "Username"], "Name"),
    phone: ensureColumn(sh, headers, ["Phone", "phone", "Mobile", "mobile", "Mobile Number", "WhatsApp", "Number", "Contact"], "Phone"),
    city: ensureColumn(sh, headers, ["City", "city", "City / State", "State", "Location"], "City"),
    language: ensureColumn(sh, headers, ["Language", "language", "Lang", "Preferred Language", "Language preference"], "Language"),
    address: ensureColumn(sh, headers, ["Address", "address", "Full Address", "Location Address"], "Address"),
    ownershipType: ensureColumn(sh, headers, ["Own/Rental", "Own / Rental", "Ownership", "Ownership Type", "Property Type"], "Own/Rental"),
    stage: ensureColumn(sh, headers, ["Stage", "stage", "CRM Stage", "Lead Stage"], "Stage"),
    notes: ensureColumn(sh, headers, ["Notes", "notes", "CRM Notes", "Call Notes"], "Notes"),
    nextFollowUpAt: ensureColumn(sh, headers, ["Next Follow-up", "Next Follow Up", "nextFollowUpAt", "Follow-up Date"], "Next Follow-up"),
    lastContactedAt: ensureColumn(sh, headers, ["Last Contacted At", "lastContactedAt", "Last Call At"], "Last Contacted At")
  };

  if (!rowNumber) {
    rowNumber = Math.max(sh.getLastRow() + 1, 2);
  }

  const updates = [
    [columns.atmId, lead.atmId],
    [columns.name, lead.name || ""],
    [columns.phone, lead.phone || ""],
    [columns.city, lead.city || ""],
    [columns.language, lead.language || ""],
    [columns.address, lead.address || ""],
    [columns.ownershipType, lead.ownershipType || ""],
    [columns.stage, lead.stage || ""],
    [columns.notes, lead.notes || ""],
    [columns.nextFollowUpAt, lead.nextFollowUpAt || ""],
    [columns.lastContactedAt, lead.lastContactedAt || ""]
  ];

  updates.forEach(item => {
    sh.getRange(rowNumber, item[0] + 1).setValue(item[1]);
  });

  return json({ ok: true, updated: true, rowNumber: rowNumber });
}

function doPost(e) {
  try {
    const key = (e.parameter && e.parameter.key) || "";
    const cleanKey = String(key).replace(/^['"]|['"]$/g, "").trim();
    const cleanApiKey = String(API_KEY).replace(/^['"]|['"]$/g, "").trim();
    if (!cleanApiKey || cleanKey !== cleanApiKey) {
      return json({ ok: false, error: "Unauthorized" });
    }
    const body = e.postData?.contents ? JSON.parse(e.postData.contents) : {};
    if (body.action === "updateInstagramLead") {
      return updateInstagramLead(body);
    }
    const sheetId = (body.sheetId || "").trim();
    const sheetName = (body.sheetName || "").trim();
    if (!sheetId || !sheetName) {
      return json({ ok: false, error: "sheetId and sheetName are required" });
    }
    const ss = SpreadsheetApp.openById(sheetId);
    const sh = ss.getSheetByName(sheetName);
    if (!sh) {
      return json({ ok: false, error: "Sheet tab not found" });
    }
    const values = sh.getDataRange().getValues();
    if (values.length < 2) {
      return json({ ok: true, rows: [], count: 0 });
    }
    const headers = values[0].map(h => String(h).trim());
    const rows = values.slice(1).map((row, index) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      obj.rowNumber = index + 2;
      return obj;
    });
    return json({ ok: true, count: rows.length, rows });
  } catch (err) {
    return json({ ok: false, error: "Server error", detail: String(err?.message || err) });
  }
}

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    const source = SHEET_SOURCE_MAP[sheetName] || "WEBSITE";
    const row = e.range.getRow();
    if (row === 1) return;
    syncSingleRow(sheet, row, source);
  } catch (err) {
    Logger.log("onEdit Error: " + err);
  }
}

function onChange(e) {
  try {
    if (!e) return;
    if (e.changeType !== "INSERT_ROW" && e.changeType !== "EDIT") return;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const sheetName = sheet.getName();
    const source = SHEET_SOURCE_MAP[sheetName] || "WEBSITE";
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;
    syncSingleRow(sheet, lastRow, source);
  } catch (err) {
    Logger.log("onChange Error: " + err);
  }
}

function installAutoSyncTriggers() {
  const spreadsheet = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers().forEach(trigger => {
    const handler = trigger.getHandlerFunction();
    if (handler === "onEditInstalled" || handler === "onChangeInstalled") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("onEditInstalled")
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  ScriptApp.newTrigger("onChangeInstalled")
    .forSpreadsheet(spreadsheet)
    .onChange()
    .create();

  return "Auto-sync triggers installed. Edit or add a row in either configured tab to push it to CRM.";
}

function onEditInstalled(e) {
  onEdit(e);
}

function onChangeInstalled(e) {
  onChange(e);
}

function syncSingleRow(sheet, rowNumber, source) {
  try {
    const data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    const headers = data[0];
    const row = data[rowNumber - 1];
    if (!row) return;
    const lead = {};
    headers.forEach((header, i) => {
      lead[String(header).trim()] = row[i];
    });
    const phone = String(lead.phone || lead.Phone || "").trim();
    const name = String(lead.name || lead.Name || "").trim();
    if (!name && !phone) return;
    if (!lead["ATM-ID"] && !lead["atmId"] && !lead["AtmId"]) {
      lead["ATM-ID"] = buildFallbackAtmId(source, sheet, rowNumber, phone);
    }
    lead.source = source;
    lead.sheetRow = rowNumber;
    lead.syncedAt = new Date().toISOString();
    const webhookUrl = CRM_URL + "/api/sync-lead";
    const payload = {
      source: source,
      secretToken: API_KEY,
      lead: lead
    };
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(webhookUrl, options);
    Logger.log("SYNC SUCCESS | Row: " + rowNumber + " | Code: " + response.getResponseCode());
  } catch (err) {
    Logger.log("SYNC FAILED | Row: " + rowNumber + " | Error: " + err);
  }
}

function testSyncBothSheets() {
  Object.keys(SHEET_SOURCE_MAP).forEach(sheetName => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;
    syncSingleRow(sheet, sheet.getLastRow(), SHEET_SOURCE_MAP[sheetName]);
  });
}

function testSync() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const source = SHEET_SOURCE_MAP[sheet.getName()] || "WEBSITE";
  syncSingleRow(sheet, 2, source);
}`;

  // Stages styling dictionary
  const stageStyles: Record<LeadStage, { border: string; bg: string; text: string }> = {
    NEW: { border: "border-sky-500/20", bg: "bg-sky-500/10", text: "text-sky-300" },
    CONTACTED: { border: "border-indigo-500/20", bg: "bg-indigo-500/10", text: "text-indigo-300" },
    FOLLOW_UP: { border: "border-amber-500/25", bg: "bg-amber-500/10", text: "text-amber-300" },
    INTERESTED: { border: "border-emerald-500/20", bg: "bg-emerald-500/10", text: "text-emerald-300" },
    NOT_INTERESTED: { border: "border-rose-500/20", bg: "bg-rose-500/10", text: "text-rose-300" },
    NO_RESPONSE: { border: "border-zinc-500/20", bg: "bg-zinc-500/10", text: "text-zinc-400" },
    CONVERTED: { border: "border-teal-400/20", bg: "bg-teal-400/15", text: "text-teal-300" },
    CLOSED: { border: "border-purple-400/20", bg: "bg-purple-400/10", text: "text-purple-300" },
  };

  // 1. Process and Filter Leads list
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lead.atmId && lead.atmId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (lead.city && lead.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (lead.phone && lead.phone.includes(searchQuery)) ||
        (lead.provider && lead.provider.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStage =
        selectedStageFilter === "ALL" || lead.stage === selectedStageFilter;

      const matchesAgent =
        selectedAgentFilter === "ALL" ||
        (selectedAgentFilter === "UNASSIGNED" && !lead.assignedToId) ||
        lead.assignedToId === selectedAgentFilter;

      return matchesSearch && matchesStage && matchesAgent;
    });
  }, [leads, searchQuery, selectedStageFilter, selectedAgentFilter]);

  // Dynamic Metrics derived from current list
  const metrics = useMemo(() => {
    const stats = {
      total: leads.length,
      newCount: leads.filter((l) => l.stage === "NEW").length,
      followUpCount: leads.filter((l) => l.stage === "FOLLOW_UP").length,
      convertedCount: leads.filter((l) => l.stage === "CONVERTED").length,
    };
    return stats;
  }, [leads]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLeads = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;

    return filteredLeads.slice(startIndex, startIndex + pageSize);
  }, [filteredLeads, safeCurrentPage]);
  const allPageLeadsSelected =
    paginatedLeads.length > 0 &&
    paginatedLeads.every((lead) => selectedLeadIds.includes(lead.id));

  // Bulk Actions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeadIds((prev) =>
        Array.from(new Set([...prev, ...paginatedLeads.map((lead) => lead.id)])),
      );
    } else {
      setSelectedLeadIds((prev) =>
        prev.filter((id) => !paginatedLeads.some((lead) => lead.id === id)),
      );
    }
  };

  const handleSelectOne = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeadIds((prev) => [...prev, leadId]);
    } else {
      setSelectedLeadIds((prev) => prev.filter((id) => id !== leadId));
    }
  };

  const handleBulkAssign = () => {
    if (!bulkAgentId || selectedLeadIds.length === 0) return;

    const agentIdVal = bulkAgentId === "UNASSIGNED" ? null : bulkAgentId;

    startTransition(async () => {
      const res = await adminAssignLeadsAction(selectedLeadIds, selectedSource, agentIdVal);
      if (res.error) {
        alert(res.error);
      } else {
        setSelectedLeadIds([]);
        setBulkAgentId("");
        router.refresh();
      }
    });
  };

  const handleMarkSelectedRead = () => {
    if (selectedLeadIds.length === 0) return;

    startTransition(async () => {
      const res = await adminMarkLeadsReadAction(selectedLeadIds, selectedSource);
      if (res.error) {
        alert(res.error);
      } else {
        setSelectedLeadIds([]);
        router.refresh();
      }
    });
  };

  const handleDeleteSelected = () => {
    if (selectedLeadIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedLeadIds.length} selected lead${selectedLeadIds.length > 1 ? "s" : ""} from CRM? This will not delete rows from Google Sheets.`
    );

    if (!confirmed) return;

    startTransition(async () => {
      const res = await adminDeleteLeadsAction(selectedLeadIds, selectedSource);
      if (res.error) {
        alert(res.error);
      } else {
        setSelectedLeadIds([]);
        router.refresh();
      }
    });
  };

  // Open action panel for a specific lead
  const openActionPanel = (lead: LeadRow) => {
    setActiveLead(lead);
    setDetailName(lead.name || "");
    setDetailPhone(lead.phone || "");
    setDetailCity(lead.city || "");
    setDetailLanguage(lead.language || "");
    setDetailAddress(lead.address || "");
    setDetailOwnershipType(lead.ownershipType || "");
    setPanelStage(lead.stage);
    setPanelNotes(lead.notes || "");
    setErrorMessage(null);
    setSuccessMessage(null);
    setWarningMessage(null);

    // Format nextFollowUpAt for date-time local input
    if (lead.nextFollowUpAt) {
      const date = new Date(lead.nextFollowUpAt);
      // Adjust to local ISO string
      const offsetMs = date.getTimezoneOffset() * 60 * 1000;
      const localISO = new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
      setPanelFollowUp(localISO);
    } else {
      setPanelFollowUp("");
    }
  };

  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setWarningMessage(null);

    startTransition(async () => {
      const res = await updateLeadDetailsAction(activeLead.id, selectedSource, {
        name: detailName,
        phone: detailPhone,
        city: detailCity,
        language: detailLanguage,
        address: detailAddress,
        ownershipType: detailOwnershipType,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        if (res.warning) {
          setWarningMessage(res.warning);
          setSuccessMessage("Lead details saved in CRM.");
        } else {
          setSuccessMessage("Lead details saved and synced to Instagram sheet.");
        }
        setActiveLead({
          ...activeLead,
          name: detailName,
          phone: detailPhone || null,
          city: detailCity || null,
          language: detailLanguage || null,
          address: detailAddress || null,
          ownershipType: detailOwnershipType || null,
        });
        router.refresh();
      }
    });
  };

  // Submit action panel modifications
  const handleSaveWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setWarningMessage(null);

    startTransition(async () => {
      const res = await updateLeadWorkflowAction(activeLead.id, selectedSource, {
        stage: panelStage,
        notes: panelNotes,
        nextFollowUpAt: panelFollowUp || undefined,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        if (res.warning) {
          setWarningMessage(res.warning);
          setSuccessMessage("Lead updated in CRM.");
        } else {
          setSuccessMessage("Lead updated and synced to Instagram sheet.");
        }
        // Simply trigger Next.js page revalidation
        router.refresh();

        // Auto close or keep open? Let's close after 800ms
        setTimeout(() => {
          setActiveLead(null);
        }, 800);
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* 1. Page Header */}
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
            Pipeline Center
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl text-white">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        </div>
      </section>

      {/* 2. Sheet Sync Connection Status Section (Admin Only & If requested) */}
      {showSourceStatus ? (
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Google Sheet Sync Status</h2>
                {/* Auto Sync Live Badge - dynamic based on actual webhook connection status */}
                {(() => {
                  const connectedCount = sourceStatuses.filter(s => s.status === "Connected").length;
                  const errorCount = sourceStatuses.filter(s => s.status === "Error").length;
                  if (connectedCount > 0 && errorCount === 0) {
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {connectedCount === sourceStatuses.length ? "All Sources Live" : `${connectedCount} Source${connectedCount > 1 ? "s" : ""} Live`}
                      </span>
                    );
                  } else if (errorCount > 0 && connectedCount > 0) {
                    return (
                      <button
                        onClick={() => setShowSyncErrors(prev => !prev)}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20 bg-amber-500/10 text-amber-300 cursor-pointer transition hover:bg-amber-500/20 hover:border-amber-400/40 active:scale-95"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Partial Sync - {errorCount} Error{errorCount > 1 ? "s" : ""}
                        <svg className={`h-3 w-3 transition-transform ${showSyncErrors ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    );
                  } else if (errorCount > 0) {
                    return (
                      <button
                        onClick={() => setShowSyncErrors(prev => !prev)}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-rose-500/20 bg-rose-500/10 text-rose-300 cursor-pointer transition hover:bg-rose-500/20 hover:border-rose-400/40 active:scale-95"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                        Sync Error - Action Required
                        <svg className={`h-3 w-3 transition-transform ${showSyncErrors ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    );
                  } else {
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-slate-500/20 bg-slate-500/10 text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                        Not Connected
                      </span>
                    );
                  }
                })()}
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                Synchronize raw Google Sheet records into standard database leads. Real-time automatic webhook sync trigger is fully supported.
              </p>

              {/* Expandable Error Details Panel */}
              {showSyncErrors && (
                <div className="mt-3 space-y-2 animate-in">
                  {sourceStatuses.filter(s => s.status === "Error").map((src) => (
                    <div key={src.source} className="rounded-lg border border-rose-500/20 bg-rose-500/[0.05] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
                          <span className="text-xs font-bold text-rose-200">{src.title}</span>
                          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${src.tone}`}>{src.source}</span>
                        </div>
                        <a
                          href="/admin/settings"
                          className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 hover:underline transition"
                        >
                          Fix in Settings
                        </a>
                      </div>
                      {src.lastError && (
                        <div className="rounded bg-black/40 border border-rose-500/10 p-2.5 text-[11px] font-mono text-rose-200/90 break-all leading-relaxed">
                          <span className="text-rose-400 font-bold">Error: </span>{src.lastError}
                        </div>
                      )}
                      <div className="flex gap-4 text-[10px] text-slate-500">
                        <span>Imported: <strong className="text-slate-300">{src.importedCount}</strong></span>
                        <span>Failed: <strong className="text-rose-300">{src.failedCount}</strong></span>
                        {src.lastSyncedAt && (
                          <span>Last sync: <strong className="text-slate-300">{new Date(src.lastSyncedAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {selectedSourceStatus?.spreadsheetId && (
                <a
                  className="h-10 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 text-xs font-bold leading-10 text-cyan-300 transition hover:bg-cyan-500/10 hover:text-cyan-200 flex items-center gap-1.5 active:scale-95 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                  href={`https://docs.google.com/spreadsheets/d/${selectedSourceStatus.spreadsheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>Open Sheet</span>
                </a>
              )}
              <button
                onClick={handleModalSync}
                disabled={modalSyncing}
                className="h-10 rounded-lg bg-emerald-400 px-4 text-xs font-bold text-slate-950 transition hover:bg-emerald-300 hover:shadow-[0_0_15px_rgba(52,211,153,0.4)] active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {modalSyncing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
                    </svg>
                    <span>Sync Both Sheets</span>
                  </>
                )}
              </button>
              <a
                className="h-10 rounded-lg border border-white/10 px-4 text-sm font-semibold leading-10 text-slate-200 transition hover:bg-white/10 hover:text-white"
                href="/admin/settings"
              >
                Configure sync settings
              </a>
            </div>
          </div>

          {sourceStatusError ? (
            <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              {sourceStatusError}
            </div>
          ) : null}

          {modalSyncSuccess && (
            <div className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-4 py-2.5 text-xs text-emerald-100 flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {modalSyncSuccess}
            </div>
          )}

          {modalSyncError && (
            <div className="mt-3 rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 py-2.5 text-xs text-rose-100 flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>Sync failed:</strong> {modalSyncError}</span>
            </div>
          )}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {sourceStatuses.map((source) => (
              <div
                className="rounded-lg border border-white/5 bg-black/30 p-4 transition hover:border-white/10"
                key={source.source}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-100">{source.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {source.lastSyncedAt
                        ? `Last synced: ${new Date(source.lastSyncedAt).toLocaleString("en-IN")}`
                        : "Never synced"}
                    </p>
                  </div>
                  <span
                    className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${source.tone}`}
                  >
                    {source.source}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/5 bg-white/[0.01] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Connection</p>
                    <p className="mt-1 text-sm font-semibold text-amber-100">
                      {source.status}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/[0.01] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Imported</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {source.importedCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/[0.01] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Failed</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {source.failedCount}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 3. Metrics Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Pipeline Total", metrics.total, "border-cyan-500/10 bg-cyan-500/[0.02] text-cyan-200"],
          ["New Leads", metrics.newCount, "border-sky-500/10 bg-sky-500/[0.02] text-sky-200"],
          ["Active Follow-ups", metrics.followUpCount, "border-amber-500/10 bg-amber-500/[0.02] text-amber-200"],
          ["Pipeline Converted", metrics.convertedCount, "border-emerald-500/10 bg-emerald-500/[0.02] text-emerald-200"],
        ].map(([label, value, styles]) => (
          <div
            className={`rounded-xl border p-5 backdrop-blur-md transition hover:scale-[1.02] ${styles}`}
            key={label}
          >
            <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>

      {/* 4. Lead Filters & Listing Panel */}
      <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-md">

        {/* Bulk Action Toolbar */}
        {isAdmin && selectedLeadIds.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-4 bg-cyan-950/40 border-b border-cyan-500/20 px-5 py-3">
            <span className="text-sm font-medium text-cyan-200">
              {selectedLeadIds.length} lead{selectedLeadIds.length > 1 ? "s" : ""} selected for actions:
            </span>
            <div className="flex items-center gap-2">
              {showMarkReadAction ? (
                <button
                  className="h-9 rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 text-xs font-bold text-amber-100 transition hover:bg-amber-400/20 disabled:opacity-50 cursor-pointer"
                  disabled={isPending}
                  onClick={handleMarkSelectedRead}
                >
                  {isPending ? "Marking..." : "Mark Read"}
                </button>
              ) : null}
              <select
                className="h-9 rounded-lg border border-cyan-500/20 bg-black/40 px-3 text-xs text-slate-200 outline-none"
                value={bulkAgentId}
                onChange={(e) => setBulkAgentId(e.target.value)}
              >
                <option value="">Select Agent...</option>
                <option value="UNASSIGNED">Unassign Leads</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.username} ({agent.department || "Other"})
                  </option>
                ))}
              </select>
              <button
                className="h-9 rounded-lg bg-cyan-400 px-4 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50 cursor-pointer"
                disabled={!bulkAgentId || isPending}
                onClick={handleBulkAssign}
              >
                {isPending ? "Assigning..." : "Apply Assignment"}
              </button>
              <button
                className="h-9 rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 text-xs font-bold text-rose-100 transition hover:bg-rose-400/20 disabled:opacity-50 cursor-pointer"
                disabled={isPending}
                onClick={handleDeleteSelected}
              >
                {isPending ? "Deleting..." : "Delete"}
              </button>
              <button
                className="h-9 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer"
                onClick={() => setSelectedLeadIds([])}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {/* Filters Header */}
        <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-white">{stageLabel}</h2>

            {/* Lead Source Filter Form */}
            <form action={actionPath} className="m-0 flex items-center gap-2">
              <label className="sr-only" htmlFor="lead-source-filter">
                Lead source
              </label>
              <select
                className="h-9 rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                defaultValue={selectedSource}
                id="lead-source-filter"
                name="source"
              >
                {sourceOptions.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </select>
              <button
                className="h-9 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/10 cursor-pointer"
                type="submit"
              >
                Apply Source
              </button>
            </form>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search leads..."
              className="h-9 w-48 sm:w-64 rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300 placeholder:text-slate-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Stage Filter */}
            <select
              className="h-9 rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
              value={selectedStageFilter}
              onChange={(e) => setSelectedStageFilter(e.target.value)}
            >
              <option value="ALL">All Stages</option>
              {Object.keys(stageStyles).map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>

            {/* Agent/Owner Filter (Admin Only) */}
            {isAdmin ? (
              <select
                className="h-9 rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                value={selectedAgentFilter}
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
              >
                <option value="ALL">All Agents</option>
                <option value="UNASSIGNED">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.username} ({agent.department || "Other"})
                  </option>
                ))}
              </select>
            ) : null}

            <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-slate-300 font-medium">
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Leads Table */}
        {filteredLeads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  {isAdmin ? (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-white/10 bg-black/40"
                        checked={allPageLeadsSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                  ) : null}
                  <th className="px-4 py-3 font-semibold text-slate-200">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-200">ATM-ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-200">Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-200">Phone</th>
                  <th className="px-4 py-3 font-semibold text-slate-200">City / State</th>
                  <th className="px-4 py-3 font-semibold text-slate-200">Language</th>
                  <th className="px-4 py-3 font-semibold text-slate-200">Stage</th>
                  <th className="px-4 py-3 font-semibold text-slate-200">Assigned Agent</th>
                  {isAdmin ? <th className="px-4 py-3 font-semibold text-slate-200">Quick Assign</th> : null}
                  <th className="px-4 py-3 font-semibold text-slate-200">Next Follow-up</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.map((lead) => {
                  const stageStyle = stageStyles[lead.stage] || {
                    border: "border-white/10",
                    bg: "bg-white/5",
                    text: "text-white",
                  };

                  // Check if follow-up is overdue
                  let isOverdue = false;
                  if (lead.stage === "FOLLOW_UP" && lead.nextFollowUpAt) {
                    isOverdue = new Date(lead.nextFollowUpAt) < new Date();
                  }

                  return (
                    <tr
                      className="border-b border-white/5 transition hover:bg-white/[0.02]"
                      key={lead.id}
                    >
                      {isAdmin ? (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="rounded border-white/10 bg-black/40"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-3 font-semibold text-slate-400">
                        {formatLeadDate(lead, selectedSource)}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-200">
                        {lead.atmId || "N/A"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-100">
                        {lead.name}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{lead.phone || "N/A"}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {lead.city || "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md border border-cyan-400/15 bg-cyan-400/5 px-2 py-1 text-[11px] font-semibold text-cyan-200">
                          {lead.language || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${stageStyle.border} ${stageStyle.bg} ${stageStyle.text}`}
                        >
                          {lead.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {lead.assignedTo?.username ? (
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                              <span>{lead.assignedTo.username}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block ml-3 mt-0.5">
                              {lead.assignedTo.department || "Other"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Quick Assign Column (Admin Only) */}
                      {isAdmin ? (
                        <td className="px-4 py-3">
                          {quickAssignLeadId === lead.id ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                autoFocus
                                className="h-8 rounded-lg border border-cyan-500/30 bg-black/60 px-2 text-[11px] text-slate-200 outline-none focus:border-cyan-400"
                                value={quickAssignAgentId}
                                onChange={(e) => setQuickAssignAgentId(e.target.value)}
                              >
                                <option value="">Select agent...</option>
                                <option value="UNASSIGNED">Unassign</option>
                                {agents.map((agent) => (
                                  <option key={agent.id} value={agent.id}>
                                    {agent.username} ({agent.department || "Other"})
                                  </option>
                                ))}
                              </select>
                              <button
                                disabled={!quickAssignAgentId || isPending}
                                className="h-8 rounded-lg bg-cyan-400 px-2 text-[10px] font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40 cursor-pointer"
                                onClick={() => {
                                  if (!quickAssignAgentId) return;
                                  const agentIdVal = quickAssignAgentId === "UNASSIGNED" ? null : quickAssignAgentId;
                                  startTransition(async () => {
                                    const res = await adminAssignLeadsAction([lead.id], selectedSource, agentIdVal);
                                    if (res.error) { alert(res.error); }
                                    else { setQuickAssignLeadId(null); setQuickAssignAgentId(""); router.refresh(); }
                                  });
                                }}
                              >
                                {isPending ? "..." : "Save"}
                              </button>
                              <button
                                className="h-8 w-8 rounded-lg border border-white/10 text-[10px] text-slate-400 hover:text-white cursor-pointer"
                                onClick={() => { setQuickAssignLeadId(null); setQuickAssignAgentId(""); }}
                              >
                                X
                              </button>
                            </div>
                          ) : (
                            <button
                              className="h-8 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-500/20 hover:border-amber-400/40 cursor-pointer"
                              onClick={() => { setQuickAssignLeadId(lead.id); setQuickAssignAgentId(lead.assignedToId || ""); }}
                            >
                              {lead.assignedTo?.username ? "Reassign" : "Assign"}
                            </button>
                          )}
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        {lead.nextFollowUpAt ? (
                          <span
                            className={`font-semibold ${isOverdue ? "text-rose-400 animate-pulse" : "text-amber-200"
                              }`}
                          >
                            {new Date(lead.nextFollowUpAt).toLocaleString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="h-8 rounded-lg bg-white/5 border border-white/10 px-3 text-[11px] font-bold text-slate-200 transition hover:bg-cyan-300 hover:text-slate-950 hover:border-cyan-300 cursor-pointer"
                          onClick={() => openActionPanel(lead)}
                        >
                          View & Call
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredLeads.length > pageSize ? (
              <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {(safeCurrentPage - 1) * pageSize + 1}-
                  {Math.min(safeCurrentPage * pageSize, filteredLeads.length)} of{" "}
                  {filteredLeads.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="h-8 rounded-lg border border-white/10 px-3 font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </button>
                  <span className="rounded-lg bg-white/10 px-3 py-1 font-semibold text-slate-200">
                    {safeCurrentPage} / {totalPages}
                  </span>
                  <button
                    className="h-8 rounded-lg border border-white/10 px-3 font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-lg font-semibold text-white">No prospects match</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              No database records match your filter. Sync records from Settings if needed.
            </p>
          </div>
        )}
      </section>

      {/* 5. Right Slide-out Sidebar Action Panel */}
      {activeLead ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setActiveLead(null)} />

          <div className="relative z-10 flex h-full w-full flex-col border-l border-white/10 bg-[#0e0f14] shadow-2xl sm:max-w-md md:max-w-lg transition-transform animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <span className="font-mono text-xs font-bold text-cyan-200 uppercase">
                  ATM Lead Action Panel
                </span>
                <h3 className="mt-1 text-xl font-bold text-white">{activeLead.name}</h3>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:text-white cursor-pointer"
                onClick={() => setActiveLead(null)}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Profile Details Card */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Lead Context</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="block text-slate-500">ATM-ID</span>
                    <span className="font-mono font-bold text-slate-200">{activeLead.atmId || "N/A"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">City & State</span>
                    <span className="font-semibold text-slate-200">{activeLead.city || "N/A"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Phone Number</span>
                    <a href={`tel:${activeLead.phone}`} className="font-semibold text-cyan-300 hover:underline">
                      {activeLead.phone || "N/A"}
                    </a>
                  </div>
                  <div>
                    <span className="block text-slate-500">Email Address</span>
                    <span className="font-semibold text-slate-200">{activeLead.email || "N/A"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Preferred Provider</span>
                    <span className="font-semibold text-slate-200">{activeLead.provider || "N/A"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Language preference</span>
                    <span className="font-semibold text-slate-200">{activeLead.language || "N/A"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Own / Rental</span>
                    <span className="font-semibold text-slate-200">{activeLead.ownershipType || "N/A"}</span>
                  </div>
                </div>
                {activeLead.address ? (
                  <div className="pt-2 border-t border-white/5 text-xs">
                    <span className="block text-slate-500">Address</span>
                    <p className="mt-1 text-slate-300 leading-relaxed">{activeLead.address}</p>
                  </div>
                ) : null}
                {activeLead.message ? (
                  <div className="pt-2 border-t border-white/5 text-xs">
                    <span className="block text-slate-500">Google Sheet Note / Message</span>
                    <p className="mt-1 text-slate-300 leading-relaxed italic">
                      &quot;{activeLead.message}&quot;
                    </p>
                  </div>
                ) : null}
              </div>

              {errorMessage ? (
                <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-xs text-rose-200">
                  {errorMessage}
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs text-emerald-200">
                  {successMessage}
                </div>
              ) : null}

              {warningMessage ? (
                <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs text-amber-100">
                  {warningMessage}
                </div>
              ) : null}

              <form onSubmit={handleSaveDetails} className="space-y-4 rounded-xl border border-white/5 bg-white/[0.01] p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Call Details</h4>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[11px] text-slate-400">Customer Name</span>
                    <input
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                      value={detailName}
                      onChange={(e) => setDetailName(e.target.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[11px] text-slate-400">Phone Number</span>
                    <input
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                      value={detailPhone}
                      onChange={(e) => setDetailPhone(e.target.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[11px] text-slate-400">City / State</span>
                    <input
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                      value={detailCity}
                      onChange={(e) => setDetailCity(e.target.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[11px] text-slate-400">Language</span>
                    <input
                      className="h-10 w-full rounded-lg border border-cyan-400/20 bg-black/40 px-3 text-xs font-semibold text-cyan-100 outline-none focus:border-cyan-300"
                      value={detailLanguage}
                      onChange={(e) => setDetailLanguage(e.target.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[11px] text-slate-400">Own / Rental</span>
                    <select
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                      value={detailOwnershipType}
                      onChange={(e) => setDetailOwnershipType(e.target.value)}
                    >
                      <option value="">Not confirmed</option>
                      <option value="OWN">Own</option>
                      <option value="RENTAL">Rental</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-[11px] text-slate-400">Address</span>
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-slate-200 outline-none focus:border-cyan-300 placeholder:text-slate-600"
                    value={detailAddress}
                    onChange={(e) => setDetailAddress(e.target.value)}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isPending}
                  className="h-10 w-full rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400 hover:text-slate-950 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Saving..." : "Save Call Details"}
                </button>
              </form>

              {/* Status & Follow-up log forms */}
              <form onSubmit={handleSaveWorkflow} className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pipeline Progression</h4>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[11px] text-slate-400">Lead Stage</span>
                    <select
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                      value={panelStage}
                      onChange={(e) => setPanelStage(e.target.value as LeadStage)}
                    >
                      {Object.keys(stageStyles).map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[11px] text-slate-400">Next Follow-up</span>
                    <input
                      type="datetime-local"
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-slate-200 outline-none focus:border-cyan-300"
                      value={panelFollowUp}
                      onChange={(e) => setPanelFollowUp(e.target.value)}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-[11px] text-slate-400">Call / Pipeline Notes</span>
                  <textarea
                    rows={3}
                    placeholder="Wants ATM on commission basis. Schedule callback on Friday..."
                    className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-slate-200 outline-none focus:border-cyan-300 placeholder:text-slate-600"
                    value={panelNotes}
                    onChange={(e) => setPanelNotes(e.target.value)}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isPending}
                  className="h-11 w-full rounded-lg bg-cyan-400 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Saving Workflow..." : "Save Pipeline State"}
                </button>
              </form>

              {/* Activity Audit Timeline Logs */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Activity Timeline Audit Logs</h4>
                {activeLead.activities && activeLead.activities.length > 0 ? (
                  <div className="relative border-l border-white/10 ml-2 pl-4 space-y-4">
                    {activeLead.activities.map((activity) => (
                      <div className="relative" key={activity.id}>
                        {/* Bullet indicator */}
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-slate-950 bg-cyan-400" />
                        <div className="text-xs">
                          <p className="font-semibold text-slate-200">{activity.description}</p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {new Date(activity.createdAt).toLocaleString("en-IN")}
                            {activity.user?.username ? ` by ${activity.user.username}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No activity logs recorded yet.</p>
                )}
              </div>

            </div>
          </div>
        </div>
      ) : null}

      {/* Google Sheets Auto-Sync Trigger Modal */}
      {isAutoSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsAutoSyncModalOpen(false)}
            className="absolute inset-0 bg-black/85 backdrop-blur-sm transition-opacity"
          />

          <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-[#0c0f17] p-6 shadow-2xl transition-all duration-300 hover:border-emerald-500/30 text-left">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />

            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-300 uppercase tracking-widest">
                  Webhook Integration
                </span>
                <h3 className="text-xl font-bold text-white tracking-tight mt-1">Connect Real-Time Auto Sync</h3>
                <p className="text-xs text-slate-400 mt-1">Needs a public CRM URL and installable Apps Script triggers for both sheet tabs.</p>
              </div>
              <button
                onClick={() => setIsAutoSyncModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-5 text-xs">
              {modalSyncSuccess && (
                <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-100 flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{modalSyncSuccess}</span>
                </div>
              )}

              {modalSyncError && (
                <div className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-xs text-rose-100 flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span><strong>Sync failed:</strong> {modalSyncError}</span>
                </div>
              )}

              {/* Two-Column Premium Dashboard Grid */}
              <div className="grid gap-5 md:grid-cols-5">
                {/* Left Column (Span 2): Live Status & CRM parameters */}
                <div className="md:col-span-2 space-y-4">
                  {/* Live Connection Card */}
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Auto Sync Live Status</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                        selectedSourceStatus?.status === "Connected"
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                          : selectedSourceStatus?.status === "Error"
                          ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                          : "border-amber-500/25 bg-amber-500/10 text-amber-300"
                      }`}>
                        {selectedSourceStatus?.status || "Not Connected"}
                      </span>
                    </div>

                    <div className="space-y-2 text-[11px] text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Last Synced:</span>
                        <span className="font-mono text-slate-200">
                          {selectedSourceStatus?.lastSyncedAt
                            ? new Date(selectedSourceStatus.lastSyncedAt).toLocaleString("en-IN")
                            : "Never"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Last Tested:</span>
                        <span className="font-mono text-slate-200">
                          {selectedSourceStatus?.lastTestedAt
                            ? new Date(selectedSourceStatus.lastTestedAt).toLocaleString("en-IN")
                            : "Never"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Synced Leads:</span>
                        <span className="text-emerald-400 font-bold">
                          {selectedSourceStatus?.importedCount ?? 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Failed Syncs:</span>
                        <span className="text-rose-400 font-bold">
                          {selectedSourceStatus?.failedCount ?? 0}
                        </span>
                      </div>
                    </div>

                    {selectedSourceStatus?.lastError && (
                      <div className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-[11px] leading-relaxed text-rose-200">
                        <div className="font-bold text-rose-300 mb-1">Error Details:</div>
                        <p className="font-mono break-all text-[10px] bg-black/30 p-1.5 rounded">{selectedSourceStatus.lastError}</p>
                      </div>
                    )}
                  </div>

                  {/* Parameters Dashboard */}
                  <div className="space-y-3">
                    {/* Webhook Endpoint */}
                    <div className="rounded-lg border border-white/5 bg-white/[0.01] p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Webhook URL</span>
                        <button
                          onClick={() => copyToClipboard(SYNC_LEAD_WEBHOOK_URL, setCopiedWebhook)}
                          className="text-slate-400 hover:text-cyan-300 transition cursor-pointer flex items-center gap-1 text-[10px]"
                        >
                          {copiedWebhook ? (
                            <span className="text-emerald-400 font-bold">Copied!</span>
                          ) : (
                            <span>Copy</span>
                          )}
                        </button>
                      </div>
                      <p className="font-mono text-[11px] text-slate-300 truncate">
                        {SYNC_LEAD_WEBHOOK_URL}
                      </p>
                    </div>

                    {/* Secret Token */}
                    <div className="rounded-lg border border-white/5 bg-white/[0.01] p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Secret Token (API_KEY)</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsTokenVisible(!isTokenVisible)}
                            className="text-slate-400 hover:text-cyan-300 transition cursor-pointer text-[10px]"
                          >
                            {isTokenVisible ? "Hide" : "Reveal"}
                          </button>
                          <span className="text-slate-600">|</span>
                          <button
                            onClick={() => copyToClipboard(displaySecretToken, setCopiedToken)}
                            className="text-slate-400 hover:text-cyan-300 transition cursor-pointer flex items-center gap-1 text-[10px]"
                          >
                            {copiedToken ? (
                              <span className="text-emerald-400 font-bold">Copied!</span>
                            ) : (
                              <span>Copy</span>
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="font-mono text-[11px] text-slate-300 truncate">
                        {isTokenVisible ? displaySecretToken : "********************************"}
                      </p>
                    </div>

                    {/* Spreadsheet ID & Tab Name */}
                    <div className="rounded-lg border border-white/5 bg-white/[0.01] p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Google Sheet Tab</span>
                        {selectedSourceStatus?.spreadsheetId && (
                          <a
                            href={`https://docs.google.com/spreadsheets/d/${selectedSourceStatus.spreadsheetId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-semibold text-cyan-300 hover:text-cyan-200 transition hover:underline"
                          >
                            Open Sheet
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-300 border border-blue-500/20 truncate max-w-[120px]" title={selectedSourceStatus?.spreadsheetId || ""}>
                          {selectedSourceStatus?.spreadsheetId || "No Spreadsheet Saved"}
                        </span>
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/20">
                          {selectedSourceStatus?.sheetName || (selectedSource === "WEBSITE" ? "Sheet1" : "Sheet2")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column (Span 3): Real-time Sync Analytics Dashboard */}
                <div className="md:col-span-3 space-y-3 flex flex-col">
                  {/* Per-source sync analytics */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Live Sync Analytics</span>
                    <div className="grid gap-2">
                      {sourceStatuses.map((src) => {
                        const isConnected = src.status === "Connected";
                        const isError = src.status === "Error";
                        const statusColor = isConnected
                          ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                          : isError
                          ? "border-rose-500/20 bg-rose-500/[0.04]"
                          : "border-white/5 bg-white/[0.01]";
                        const dotColor = isConnected
                          ? "bg-emerald-400 animate-pulse"
                          : isError
                          ? "bg-rose-400"
                          : "bg-slate-500";
                        return (
                          <div key={src.source} className={`rounded-lg border p-3 space-y-2.5 ${statusColor}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                                <span className="font-bold text-slate-100 text-[11px]">{src.title}</span>
                              </div>
                              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isConnected ? "border-emerald-500/30 text-emerald-300" : isError ? "border-rose-500/30 text-rose-300" : "border-slate-500/30 text-slate-400"}`}>
                                {src.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div className="rounded bg-black/30 p-2 text-center">
                                <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Imported</p>
                                <p className="text-base font-black text-emerald-400">{src.importedCount}</p>
                              </div>
                              <div className="rounded bg-black/30 p-2 text-center">
                                <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Failed</p>
                                <p className={`text-base font-black ${src.failedCount > 0 ? "text-rose-400" : "text-slate-400"}`}>{src.failedCount}</p>
                              </div>
                              <div className="rounded bg-black/30 p-2 text-center">
                                <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Success Rate</p>
                                <p className="text-base font-black text-cyan-300">
                                  {src.importedCount + src.failedCount > 0
                                    ? Math.round((src.importedCount / (src.importedCount + src.failedCount)) * 100) + "%"
                                    : "-"}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                              <div className="flex justify-between">
                                <span className="text-slate-500">Last Sync</span>
                                <span className="font-mono text-slate-300">
                                  {src.lastSyncedAt
                                    ? new Date(src.lastSyncedAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                                    : <span className="text-slate-600 italic">Never</span>}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Last Tested</span>
                                <span className="font-mono text-slate-300">
                                  {src.lastTestedAt
                                    ? new Date(src.lastTestedAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                                    : <span className="text-slate-600 italic">Never</span>}
                                </span>
                              </div>
                            </div>

                            {src.lastError && isError && (
                              <div className="rounded bg-rose-500/10 border border-rose-500/20 p-2 text-[10px] font-mono text-rose-200 break-all leading-relaxed">
                                {src.lastError}
                              </div>
                            )}

                            {src.spreadsheetId && (
                              <a
                                href={`https://docs.google.com/spreadsheets/d/${src.spreadsheetId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 transition hover:underline w-fit"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Open {src.sheetName || "Sheet"}
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Webhook info strip */}
                  <div className="rounded-lg border border-cyan-500/10 bg-cyan-500/[0.03] p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                      <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Webhook Endpoint (Real-time Push)</p>
                      <p className="font-mono text-[11px] text-cyan-300 truncate mt-0.5">
                        {SYNC_LEAD_WEBHOOK_URL}
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(SYNC_LEAD_WEBHOOK_URL, setCopiedWebhook)}
                      className="shrink-0 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/10 transition cursor-pointer"
                    >
                      {copiedWebhook ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/30">
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Apps Script Code</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">After pasting, run installAutoSyncTriggers once, then testSyncBothSheets.</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(appsScriptCode, setCopiedCode)}
                      className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-500/10 cursor-pointer"
                    >
                      {copiedCode ? "Copied" : "Copy Code"}
                    </button>
                  </div>
                  <pre className="max-h-56 overflow-auto p-3 text-[10px] leading-relaxed text-slate-300">
                    <code>{appsScriptCode}</code>
                  </pre>
                </div>
              </div>
            </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setIsAutoSyncModalOpen(false);
                    setModalSyncError(null);
                    setModalSyncSuccess(null);
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white cursor-pointer active:scale-95"
                >
                  Close
                </button>
                <button
                  onClick={handleModalSync}
                  disabled={modalSyncing}
                  className="rounded-lg bg-emerald-400 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-300 cursor-pointer active:scale-95 flex items-center gap-1.5 hover:shadow-[0_0_15px_rgba(52,211,153,0.4)] disabled:opacity-50"
                >
                  {modalSyncing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-slate-950" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Syncing Leads...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
                      </svg>
                      <span>Sync Both Sheets</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
