# Production-Ready Ticketing Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the current prototype into a production-grade help desk with RBAC, SLA tracking, and clear architectural layers.

**Architecture:** Use a service-based architecture in Next.js. Logic is extracted from API routes into injectable services. UI is split into Agent and Customer portals with shared reusable components.

**Tech Stack:** Next.js (Webpack), Prisma (SQLite), NextAuth.js, Zod, Zustand, Shadcn UI, Lucide React.

---

### Task 1: Schema Hardening & Extensions
**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/seed.ts`

**Step 1: Update Prisma schema**
Add missing statuses, indexes for performance, and new fields for SLA/Notifications.
```prisma
enum TicketStatus {
  NEW
  OPEN
  PENDING_CUSTOMER
  PENDING_INTERNAL
  ESCALATED
  RESOLVED
  CLOSED
}

model User {
  // ... existing
  @@index([email])
  @@index([role])
}

model Ticket {
  // ... existing
  @@index([status])
  @@index([priority])
  @@index([ticketId])
}
```

**Step 2: Update Seed script**
Update `seed.ts` to reflect new statuses and ensure IDs are consistent.

**Step 3: Run migrations**
Run: `npx prisma migrate dev --name extend_schema`
Expected: Database updated.

---

### Task 2: Service Layer Extraction
**Files:**
- Create: `src/services/ticket.service.ts`
- Create: `src/services/user.service.ts`
- Create: `src/services/sla.service.ts`

**Step 1: Implement TicketService**
Extract Prisma logic into reusable methods with Zod validation.
```typescript
export class TicketService {
  static async createTicket(data: CreateTicketInput, userId: string) {
    // validation -> sla calculation -> prisma create -> audit log
  }
}
```

---

### Task 3: RBAC & Auth Guards
**Files:**
- Create: `src/components/auth/role-gate.tsx`
- Modify: `src/lib/auth.ts`

**Step 1: Client-side RoleGate**
```tsx
export function RoleGate({ allowedRoles, children }: { allowedRoles: Role[], children: React.ReactNode }) {
  const { user } = useAppStore();
  if (!user || !allowedRoles.includes(user.role)) return null;
  return <>{children}</>;
}
```

---

### Task 4: SLA & Escalation Engine
**Files:**
- Modify: `src/services/sla.service.ts`
- Create: `src/app/api/cron/check-sla/route.ts` (simulated cron)

**Step 1: SLA Logic**
Implement logic to set `responseDeadline` and `resolutionDeadline` based on `SLAConfig`.

---

### Task 5: Agent Dashboard & Ticket List
**Files:**
- Create: `src/components/ticketing/agent-dashboard.tsx`
- Create: `src/components/ticketing/ticket-filters.tsx`
- Modify: `src/components/ticketing/ticket-list.tsx`

**Step 1: Implement Pagination & Filtering**
Update API routes to support `take`, `skip`, `where` filters.

---

### Task 6: Audit Logging & Activity
**Files:**
- Modify: `src/services/audit.service.ts`

**Step 1: Global Logger**
Every service method must call `AuditService.log(action, entity, details)`.

---

### Task 7: Final Polishing & Testing
**Files:**
- Create: `src/tests/sla.test.ts`
- Create: `src/tests/auth.test.ts`

**Step 1: Write critical tests**
Verify SLA deadlines are calculated correctly.
Verify non-admins cannot access admin API routes.

---
