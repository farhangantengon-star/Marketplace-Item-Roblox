# Security Specification: Multi-User Roblox Marketplace

## Data Invariants
1. Items cannot be created with a price less than 1 or a negative stock.
2. UGC items created by regular users (non-owner) must follow price caps and specific categories.
3. System generated IDs must match regex `^[a-zA-Z0-9_\-]+$`.
4. Global chat is append-only for authenticated users and has a size limit on messages.

## The Dirty Dozen Payloads
1. **The Ghost Creator:** Creating an item with `creator: "Roblox"` when not an admin.
2. **The Price bypass:** Updating an existing item's price to 0 or negative value.
3. **The ID Injection:** Creating an item with a 2MB string as ID.
4. **The Shadow Field:** Adding `isAdmin: true` to a chat message.
5. **The Spam Attack:** Sending a 1MB string as a chat message.
6. **The Ownership Steal:** Changing the `creator` of an item from "Owner" to "User".
7. **The Terminal Skip:** Changing the status of an item after it has been marked as 'Offsale'.
8. **The System Spoof:** Writing directly to the `items` collection without a valid secret code while choosing a restricted category like 'Hat'.
9. **The PII Leak:** Trying to read chat messages from other users (if private, but these are public).
10. **The Timestamp Forge:** Sending a past or future timestamp for a chat message instead of `request.time`.
11. **The Massive Stock:** Setting initial stock to 999,999,999,999 to crash price calculation logic.
12. **The Orphan Write:** Creating a child resource for a non-existent parent.

## Audit Checklist
- [ ] isValidItem helper enforces exact fields for creates.
- [ ] affectedKeys().hasOnly() guards every update branch.
- [ ] request.time used for all timestamps.
- [ ] isValidId() used on all {itemId} constraints.
- [ ] list queries restricted to authorized items or default page size.
