# Mismu Firestore Security Specification

## 1. Data Invariants
1. **Default-Deny Catch-All**: All unmatched paths deny read and write (`allow read, write: if false`).
2. **Admin Authorization**: Only verified admin (`shaikhmahnoor090@gmail.com` with `email_verified == true` or `/admins/{uid}` doc) may create, update, or delete `/products/{productId}`, `/cities/{cityId}`, and `/store_config/{configId}`.
3. **PII Isolation (`/orders/{orderId}`)**: Orders contain customer phone, name, and street address. Only the owning customer (`existing().customerUid == request.auth.uid` with `email_verified == true`) or an admin can `get` or `list` orders.
4. **Atomic Order + Non-PII Tracking Creation**: Creating `/orders/{orderId}` requires `customerUid == request.auth.uid`, initial `status == 'Booked at Mismu Hub'`, `createdAt == request.time`, `updatedAt == request.time`, valid referenced `cityId` (`exists(/cities/{cityId})`), bounded `items` list (`1 <= items.size() <= 50`), and atomic creation of `/shipment_tracking/{tcsTrackingId}` via `existsAfter()`.
5. **Non-PII Tracking Privacy (`/shipment_tracking/{trackingId}`)**: Only `get` by exact `trackingId` is public; `list` is restricted to `isAdmin()`.
6. **Path ID & Payload Bounds**: All document IDs match `^[a-zA-Z0-9_\-]+$` (`size() <= 128`), and every string field enforces explicit `.size()` caps (`image.size() <= 250000`).

## 2. Dirty Dozen Attack Payloads (Must All Return PERMISSION_DENIED)
1. Unauthenticated `create` on `/products/prod-hack` (`request.auth == null`).
2. Non-admin verified user `update` on `/store_config/payment_settings` changing `easypaisaAccountNumber`.
3. Non-admin user `delete` on `/cities/city-khi`.
4. Unverified email (`email_verified: false`) admin spoofing `shaikhmahnoor090@gmail.com` writing to `/products/prod-1`.
5. Customer creating `/orders/ord-1` with `customerUid: "another-user-uid"` (identity spoofing).
6. Customer creating `/orders/ord-1` with `status: "Delivered"` (state shortcutting).
7. Customer creating `/orders/ord-1` with forged `createdAt` not equal to `request.time`.
8. Customer creating `/orders/ord-1` with ghost field `isFree: true` (shadow field injection).
9. Customer creating `/orders/ord-1` without atomic `/shipment_tracking/{tcsTrackingId}` batch doc (`existsAfter` fail).
10. Customer creating `/orders/ord-1` referencing non-existent `cityId: "fake-city"`.
11. Authenticated non-owner `get` or `list` on `/orders/MSM-4821` (PII exfiltration).
12. Unauthenticated `list` query on `/shipment_tracking` or writing a 1MB string into `image`.
