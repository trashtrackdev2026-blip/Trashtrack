# Resident profile editing

Residents can update their own name and residential barangay from Profile → Personal Information. Barangay choices are limited to the canonical 13 Balete barangays. The selected barangay controls subsequent local alerts, collection display and the reporting area; existing reports retain their recorded locations.

The Android app submits authenticated requests to `POST /api/residents/profile`. The server derives the target user from the verified Firebase token, rereads the profile in a transaction, and accepts only active resident accounts. The update writes only the validated name and barangay plus its update timestamp. Roles, points, email, staff assignments and other accounts cannot be changed through this endpoint. Changes create a resident-profile audit entry; unchanged retries are no-ops.

Direct Firestore writes to protected profile fields remain restricted. This endpoint implements the user's requested resident-edit workflow without granting broader client write access.

Existing profile listeners refresh notification subscriptions, the inbox audience, collection selection and report boundaries after the barangay changes. A missing barangay is flagged explicitly; the resident can now complete it in Profile.

Validation includes all canonical barangays, missing/invalid input, ownership enforcement, staff/suspended-account rejection, field allowlisting, audit creation and unchanged retries.
