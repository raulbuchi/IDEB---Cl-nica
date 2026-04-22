# Security Spec - Phase 0

## Data Invariants
1. A user profile document ID must strictly match `request.auth.uid`.
2. A generic user can only be created as a `professional` by themselves or any role by an admin. They cannot elevate themselves to `admin`.
3. A patient must always have an `assignedProfessionalId` that belongs to an existing professional.
4. An appointment must always relate to an existing professional.
5. A medical record must always relate to an existing professional.
6. A payment must always relate to an existing professional.
7. Only admins or the assigned professional can read or modify records associated with that professional.
8. `createdAt` must strictly be the exact server time on creation and can never be updated.
9. Array or long string fields must be restricted by `.size()` limits to prevent "Denial of Wallet".

## The "Dirty Dozen" Payloads
1. **Identity Spoofing (Create User Profile):** Payload trying to create a user profile where document ID != auth uid.
2. **Privilege Escalation:** Payload where a normal user tries to update their profile with `role: 'admin'`.
3. **Shadow Update (Ghost Field):** Payload updates `notes` on an appointment but includes a ghost field `isPaid: true`.
4. **Denial of Wallet (ID Poisoning):** Payload uses a 2MB string as a document ID for an appointment.
5. **Denial of Wallet (Value Poisoning):** Payload updating professional `specialty` to a 5MB string.
6. **Temporal Integrity (Future timestamp):** Payload creates a record with `createdAt: future_date`.
7. **Temporal Integrity (Mutable timestamp):** Payload tries to change `createdAt` during an update.
8. **Relational Orphan (Patient -> Prov):** Payload trying to assign a patient to a non-existent `assignedProfessionalId`.
9. **Query Scraper:** Unauthenticated or unauthorized user calling a list query on `/patients` without proper `where` clauses filtering by `assignedProfessionalId`.
10. **RBAC bypass via spoofed email:** Attacker with a mocked token `email: 'rbuchi@gmail.com'` but `email_verified: false` trying to access admin.
11. **Outcome State Shortcircuit:** Updating an appointment `status: 'completed'` without proper prerequisites or directly bypassing required fields.
12. **PII Blanket Leak:** A professional trying to read a patient document belonging to another professional.

## Test Runner 
Will be implemented if necessary, but manual testing via "Red Team" audit will be done.
