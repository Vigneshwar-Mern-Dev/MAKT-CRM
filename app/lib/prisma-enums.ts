import type {
  LeadActivityType as PrismaLeadActivityType,
  LeadSource as PrismaLeadSource,
  LeadStage as PrismaLeadStage,
  Role as PrismaRole,
  SheetConnectionStatus as PrismaSheetConnectionStatus,
  TaskPriority as PrismaTaskPriority,
  TaskStatus as PrismaTaskStatus,
} from "@prisma/client";

export type Role = PrismaRole;
export type TaskStatus = PrismaTaskStatus;
export type TaskPriority = PrismaTaskPriority;
export type LeadSource = PrismaLeadSource;
export type LeadStage = PrismaLeadStage;
export type LeadActivityType = PrismaLeadActivityType;
export type SheetConnectionStatus = PrismaSheetConnectionStatus;

export const Role = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const satisfies Record<PrismaRole, PrismaRole>;

export const TaskStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const satisfies Record<PrismaTaskStatus, PrismaTaskStatus>;

export const TaskPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const satisfies Record<PrismaTaskPriority, PrismaTaskPriority>;

export const LeadSource = {
  WEBSITE: "WEBSITE",
  INSTAGRAM: "INSTAGRAM",
} as const satisfies Record<PrismaLeadSource, PrismaLeadSource>;

export const LeadStage = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  FOLLOW_UP: "FOLLOW_UP",
  INTERESTED: "INTERESTED",
  NOT_INTERESTED: "NOT_INTERESTED",
  NO_RESPONSE: "NO_RESPONSE",
  CONVERTED: "CONVERTED",
  CLOSED: "CLOSED",
} as const satisfies Record<PrismaLeadStage, PrismaLeadStage>;

export const LeadActivityType = {
  ASSIGNMENT_CHANGE: "ASSIGNMENT_CHANGE",
  STAGE_CHANGE: "STAGE_CHANGE",
  NOTE_ADDED: "NOTE_ADDED",
  FOLLOW_UP_UPDATE: "FOLLOW_UP_UPDATE",
  SYSTEM_SYNC: "SYSTEM_SYNC",
  CREATION: "CREATION",
} as const satisfies Record<PrismaLeadActivityType, PrismaLeadActivityType>;

export const SheetConnectionStatus = {
  NOT_CONNECTED: "NOT_CONNECTED",
  CONNECTED: "CONNECTED",
  ERROR: "ERROR",
} as const satisfies Record<
  PrismaSheetConnectionStatus,
  PrismaSheetConnectionStatus
>;
