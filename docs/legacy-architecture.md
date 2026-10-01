# Architecture Overview

The application uses Next.js App Router for UI and API routes, Prisma for persistence, NextAuth for authentication, React Query for client data fetching, and a small Socket.IO notification service for real-time notification delivery.

Core domains:

- Users and roles: employees, agents, department managers, administrators.
- Tickets: status workflow, priority, department, category, assignment, comments, notes, attachments, approvals, SLA records.
- Administration: departments, categories, SLA configuration, approvals, audit logs, and user management.
- Reporting: dashboard metrics and CSV export.

Security controls include bcrypt password hashing, server-side RBAC checks, Prisma parameterized queries, origin checks for mutating API requests, rate limiting, and browser security headers.
