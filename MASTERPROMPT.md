MASTER PROMPT
Local Wi-Fi / LAN Shared Content Platform
No Login • Real-Time Sharing • Persistent Shared Data • Open Edit/Delete

You are a Senior Software Architect, Full-Stack Engineer, System Designer, Database Architect, Network Engineer, Security Engineer, UI/UX Designer, DevOps Engineer, QA Engineer, and Product Engineer.

Build a production-ready local-first shared content platform inspired by the simplicity of Simple.Savr.

The primary purpose of this system is:

Users connected to the same Wi-Fi/LAN should be able to open the application, share content, and immediately see, edit, and delete shared content without mandatory user accounts.

The system must prioritize content sharing, not authentication, profiles, social features, or cloud storage.

1. CORE PRODUCT IDEA

The application should feel like a:

Shared Digital Board / Shared Space on the Local Network

The user should be able to:

Open the application
Enter the shared local space
Add content
See content added by other devices
Edit content
Delete content
Upload files
Download files
Refresh the browser without losing content
Close the browser without deleting content
Reopen the application and see existing content
Have changes synchronized to all connected users in real time

The core experience should be:

Open it → Share it → Everyone nearby sees it.

2. MOST IMPORTANT ARCHITECTURAL RULE
DO NOT use browser localStorage as the authoritative shared database.

This is extremely important.

Each browser has its own:

localStorage
IndexedDB
Cache
OPFS

Therefore:

Laptop A localStorage
        ≠
Laptop B localStorage
        ≠
Phone C localStorage

Browser storage can be used only for:

UI preferences
Temporary cache
Device ID
Last selected view
Offline cache
Drafts if appropriate

It MUST NOT be the authoritative source of shared content.

3. PERSISTENCE REQUIREMENT

The system MUST have a persistent local source of truth.

Use:

Local Host
   │
   ├── API
   ├── WebSocket
   ├── SQLite / equivalent embedded database
   └── Local File Storage

Recommended:

SQLite
+
Local Filesystem

SQLite stores:

Content metadata
Text
Links
Folder information
File metadata
IDs
timestamps
versions
deletion state
device metadata
permissions/settings if required

Filesystem stores:

Images
PDFs
Documents
Videos
Archives
Generic uploaded files
4. WHY DATABASE / FILE STORAGE IS REQUIRED

The application MUST survive:

Browser refresh

Example:

User A adds:

"Meeting today at 3 PM"

        ↓

Server stores it

        ↓

User A refreshes browser

        ↓

Server returns existing data

        ↓

"Meeting today at 3 PM"

The content MUST remain.

Browser close

Example:

User A
   ↓
Adds report.pdf
   ↓
Local Host stores report.pdf
   ↓
User A closes browser
   ↓
report.pdf still exists
   ↓
User A opens application again
   ↓
report.pdf appears
Uploader disconnect

If User A uploads a file and then disconnects:

User A
   │
   └── upload file
          ↓
      Local Host
          ↓
      persistent storage
          ↓
   User A disconnects
          ↓
      File remains

The content MUST NOT belong to the uploader's browser session.

5. SOURCE OF TRUTH

The local host is the authoritative source of truth.

Architecture:

                    SAME WIFI / LAN

       ┌────────────┐
       │  Laptop A  │
       └─────┬──────┘
             │
       ┌─────▼──────┐
       │   Phone B  │
       └─────┬──────┘
             │
       ┌─────▼──────┐
       │  Laptop C  │
       └─────┬──────┘
             │
             ▼
     ┌─────────────────────┐
     │   LOCAL HOST SERVER  │
     │                     │
     │  Next.js / API      │
     │  WebSocket          │
     │  SQLite             │
     │  File Storage       │
     └──────────┬──────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
   SQLite DB       Local Files
   Metadata        Actual Files

The browser is a client.

The local host owns persistent shared state.

6. NO MANDATORY LOGIN

Version 1 MUST NOT require:

Registration
Email
Password for individual users
Username account
OAuth
Google login
Apple login
Facebook login
User profile
Cloud identity

The user should enter the shared space directly.

Example:

http://192.168.1.50:3000

or an appropriate local hostname.

7. OPTIONAL SHARED-SPACE SECURITY

Although individual accounts are not required, provide an architecture that can optionally support:

Shared Space Password

This is NOT a user account.

Example:

Office Shared Space
        ↓
Optional password
        ↓
Anyone who knows password can enter

Future options may include:

Shared-space password
Device approval
Host access control
Read-only mode
Admin mode

But these must not complicate the primary V1 experience.

8. DEFAULT ACCESS MODEL

Default mode:

Anyone connected to the same LAN/Wi-Fi
can access the shared space.

Default permissions:

CREATE    ✅
VIEW      ✅
EDIT      ✅
DELETE    ✅
DOWNLOAD  ✅

The UI must clearly warn:

"This shared space is accessible to devices on the local network."

Do not falsely claim that LAN access is inherently secure.

9. REAL-TIME SYNCHRONIZATION

Use WebSocket for real-time synchronization.

Example:

User A
  │
  │ ADD CONTENT
  ▼
Server
  │
  ├──────► User B
  └──────► User C

If User B edits:

User B
  │
  │ EDIT
  ▼
Server
  │
  ├──────► User A
  └──────► User C

If User C deletes:

User C
  │
  │ DELETE
  ▼
Server
  │
  ├──────► User A
  └──────► User B

All clients must update without requiring a manual refresh.

10. IMPORTANT DIFFERENCE

WebSocket is NOT the persistent storage.

Think of it this way:

DATABASE
   =
"Remember the data"

WEBSOCKET
   =
"Tell everyone that the data changed"

Therefore:

User adds content
      ↓
Save to DB/File Storage
      ↓
Broadcast WebSocket event
      ↓
All connected users update
11. RECONNECT / REFRESH FLOW

When a browser loads the application:

Browser
   ↓
GET current shared state
   ↓
Local Host
   ↓
SQLite + File Storage
   ↓
Return current state
   ↓
Render UI
   ↓
Open WebSocket connection
   ↓
Listen for future changes

Recommended sequence:

1. Connect to server
2. Authenticate shared-space access if enabled
3. Fetch current state
4. Load content
5. Establish WebSocket
6. Subscribe to updates
7. Apply future events

Never rely on previous browser memory as the source of truth.

12. DELETE MUST PERSIST

If User A deletes:

old-report.pdf

The server must persist the deletion.

Do NOT implement deletion only as:

Remove from React state

because after refresh it may reappear.

Correct:

User deletes
      ↓
Server validates
      ↓
Database marks/removes record
      ↓
File removed/soft-deleted appropriately
      ↓
WebSocket DELETE event
      ↓
All clients remove it
      ↓
Refresh
      ↓
It remains deleted

Consider soft-delete/tombstones where required for reliable synchronization.

13. CONTENT MODEL

Support at minimum:

Text
Title
Body

Example:

Meeting
"Meeting आज 3 PM मा हुन्छ।"
Notes

Short or long notes.

Links

Example:

https://example.com
Images

Example:

photo.jpg
Documents

Example:

report.pdf
contract.docx
Generic Files

Example:

.zip
.csv
.xlsx
.mp4
.txt
Folders

Allow users to organize shared content.

14. DATABASE DESIGN

Use SQLite or another appropriate embedded persistent database.

At minimum design entities similar to:

Content
├── id
├── type
├── title
├── body
├── url
├── file_id
├── folder_id
├── created_at
├── updated_at
├── version
├── created_by_device
├── updated_by_device
└── deleted_at

For files:

File
├── id
├── original_name
├── stored_name
├── mime_type
├── size
├── checksum
├── storage_path
├── created_at
└── metadata

For devices:

Device
├── id
├── display_name
├── last_seen
├── created_at
└── metadata

Avoid creating full user accounts.

15. DEVICE ID

Since there are no user accounts, optionally generate a device ID.

Example:

device_7f83a91

Display name can be:

Laptop
Phone
Office-PC

The device ID is for synchronization/auditing, not authentication.

Do not expose unnecessary device information.

16. CONCURRENT EDITING

Multiple users may edit the same content.

Implement at minimum:

version
updated_at
updated_by_device

Example:

Content Version 1

User A edits
     ↓
Version 2

User B edits
     ↓
Version conflict detected

Use optimistic concurrency control.

Do not silently overwrite another user's recent update.

For future advanced versions, the architecture may support:

Yjs
CRDT
Operational transformation

But do not over-engineer V1 unless required.

17. FILE UPLOAD ARCHITECTURE

For files:

Browser
   ↓
Upload API
   ↓
Validate
   ↓
Generate safe internal filename
   ↓
Store in local filesystem
   ↓
Store metadata in SQLite
   ↓
Broadcast FILE_CREATED

Never use the user's original filename directly as a filesystem path.

Protect against:

../../
../../../etc/
absolute paths
path traversal
malicious filenames
18. LARGE FILE SUPPORT

For large files, design the upload system with:

Chunking
Resume
Retry
Progress indicator
Checksum/hash verification
Upload cancellation
Duplicate detection where useful

Optional future optimization:

WebRTC

can be used for direct peer-to-peer transfer.

However:

WebRTC MUST NOT become the only persistence mechanism.

If the requirement is:

"The file must still exist after the uploader disconnects"

the file must be persisted on the local host or another persistent shared storage node.

19. WEBRTC ROLE

WebRTC may be used for:

Large file transfer
High-speed peer-to-peer transfer
Future optimization

Architecture:

Small Content
     ↓
Local Server
     ↓
SQLite / File Storage

Large Transfer
     ↓
Optional WebRTC
     ↓
Peer-to-Peer

But final shared state must still be synchronized with the authoritative host.

20. UI/UX PRINCIPLE

The user should NOT feel like they are using:

"A complicated file management system."

It should feel like:

"A shared digital space around me."

The first screen should immediately show:

Shared Space
────────────────────────────

+ Add Content

Recent Shared Content

📝 Meeting Notes
🔗 Project Link
🖼 Office Photo
📄 Monthly Report
📁 Documents

Do NOT make login the first screen.

21. HOMEPAGE STRUCTURE

Recommended:

┌─────────────────────────────────────┐
│ Shared Space          🟢 Connected │
├─────────────────────────────────────┤
│                                     │
│     + Add Content                   │
│                                     │
│  Search shared content...           │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  📝 Meeting Notes                   │
│  "Meeting today at 3 PM"            │
│                                     │
│  📄 Project Report                  │
│  📷 Office Photo                   │
│                                     │
└─────────────────────────────────────┘
22. ADD CONTENT EXPERIENCE

The Add button should provide:

+ Add

├── Text
├── Note
├── Link
├── Image
├── File
└── Folder

Drag-and-drop should be supported for files.

23. CONTENT CARD

Each content item should show:

┌─────────────────────────────┐
│ 📄 Project Report           │
│                             │
│ PDF • 4.2 MB                │
│ Updated 2 minutes ago       │
│                             │
│ [Open] [Edit] [Download]    │
│ [Delete]                    │
└─────────────────────────────┘

Actions should be clear.

Do not hide important actions unnecessarily.

24. REAL-TIME UI

Show connection status:

🟢 Connected
🟡 Reconnecting
🔴 Offline

When another user changes content:

"Project Report was updated"

The UI should update automatically.

Avoid unnecessary full-page reloads.

25. OFFLINE BEHAVIOR

V1 should prioritize LAN connectivity.

If disconnected:

🔴 Connection lost
Trying to reconnect...

Do not pretend writes succeeded if the server did not persist them.

Optional future capability:

Offline drafts
Offline queue
Automatic synchronization

But never silently lose user data.

26. TECHNOLOGY STACK

Preferred frontend:

Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
Lucide Icons

Animation:

Framer Motion
and/or
GSAP

Backend may use:

Next.js API
Node.js
WebSocket

Database:

SQLite

File storage:

Local filesystem

Architecture should remain modular enough to replace SQLite later with PostgreSQL if needed.

27. NETWORK ARCHITECTURE

The application should operate primarily on:

LAN / Wi-Fi

Example:

Router
192.168.1.1

        │
        ├── Local Host
        │     192.168.1.50
        │
        ├── Laptop A
        ├── Laptop B
        └── Phone C

Users access:

http://192.168.1.50:<PORT>

or an appropriate local DNS/hostname.

Do not require internet access for core sharing.

28. HOST DEPLOYMENT

The application should be deployable on:

Option A

A normal laptop/desktop acting as the host.

Option B

A mini PC.

Option C

A local office server.

Option D

A Raspberry Pi or similar device where technically appropriate.

The host should run:

Web Application
API
WebSocket
SQLite
File Storage
29. HOST IS NOT A USER

Do not model the host as an ordinary application user.

The host is infrastructure.

Users
  ↓
Client Browser

Host
  ↓
Infrastructure / Shared Space
30. REFRESH TEST — MANDATORY

Implement automated/manual QA for:

Test:

1. User A opens application
2. User A adds "Hello World"
3. User B sees "Hello World"
4. User A refreshes
5. "Hello World" remains
6. User B refreshes
7. "Hello World" remains

Expected:

PASS
31. BROWSER CLOSE TEST — MANDATORY
1. User A adds content
2. Content appears for User B
3. User A closes browser
4. User B refreshes
5. Content still exists
6. User A reopens browser
7. Content appears again

Expected:

PASS
32. UPLOADER DISCONNECT TEST — MANDATORY
1. User A uploads report.pdf
2. Upload completes
3. User B sees report.pdf
4. User A disconnects Wi-Fi
5. User B refreshes
6. report.pdf still exists

Expected:

PASS
33. EDIT TEST — MANDATORY
User A:
"Meeting 3 PM"

User B edits:

"Meeting 4 PM"

Server:
Version 2

All clients:
"Meeting 4 PM"

Refresh must still show:

Meeting 4 PM
34. DELETE TEST — MANDATORY
User A creates:
old-report.pdf

User B deletes it.

All connected clients:
old-report.pdf disappears.

User C refreshes:

old-report.pdf must NOT return.
35. MULTI-DEVICE TEST

Test with at least:

Laptop
Laptop
Mobile

connected to the same Wi-Fi.

Verify:

CREATE
EDIT
DELETE
UPLOAD
DOWNLOAD
REFRESH
RECONNECT
DISCONNECT
36. SECURITY REQUIREMENTS

Even without login, implement:

Input validation

Validate:

Text
URLs
MIME types
filenames
metadata
request sizes
File security

Protect against:

Path traversal
Executable uploads
Malicious MIME types
Oversized uploads
Malformed files
API security

Implement appropriate:

Rate limiting
Request validation
CORS policy where applicable
CSRF protection where applicable
Secure headers
Content Security Policy
Safe file serving
Network warning

Clearly communicate:

Anyone with network access to this shared space may be able to access its contents.

37. NO FAKE SECURITY

Do not claim:

"Private"
"Secure"
"Encrypted"

unless the actual implementation supports those claims.

If LAN access is open:

Open LAN Shared Space

should be communicated honestly.

38. DATA INTEGRITY

Never let the frontend become the only source of truth.

Wrong:

React State
    ↓
WebSocket
    ↓
Other browsers

Correct:

Client
   ↓
API
   ↓
Persistent Storage
   ↓
Success
   ↓
WebSocket Broadcast
   ↓
All Clients
39. ERROR HANDLING

If persistence fails:

Database Error

DO NOT show:

"Saved successfully"

Instead:

Could not save changes.
Please try again.

If upload fails:

Upload failed
[Retry]

If WebSocket fails:

Connection lost
Reconnecting...

The UI state must reflect actual server state.

40. NO DATA RESURRECTION

A deleted item must never reappear because:

browser cache is stale
WebSocket reconnects
browser refreshes
another device reconnects
server restarts

Design synchronization carefully.

Use:

version numbers
timestamps
tombstones / soft delete where required
server-authoritative state
41. SERVER RESTART TEST

Test:

Create content
      ↓
Stop server
      ↓
Start server
      ↓
Open application
      ↓
Content still exists

Files must also remain.

42. DATABASE BACKUP

Because SQLite is the source of metadata persistence, provide a simple backup strategy.

Example:

shared-space.db

and:

shared-files/

can be backed up together.

Provide safe backup/restore architecture.

Do not make backup mandatory for basic operation.

43. PROJECT STRUCTURE

Create a clean modular structure.

Example:

shared-space/
│
├── app/
│   ├── page.tsx
│   ├── content/
│   ├── api/
│   └── ...
│
├── components/
│   ├── content/
│   ├── upload/
│   ├── shared-space/
│   └── ui/
│
├── server/
│   ├── websocket/
│   ├── services/
│   ├── storage/
│   └── ...
│
├── database/
│   ├── schema/
│   └── migrations/
│
├── storage/
│   └── shared-files/
│
├── lib/
│
├── hooks/
│
├── types/
│
└── tests/

Adjust this structure according to the selected framework architecture.

Do not create unnecessary files or abstraction layers.

44. API DESIGN

Design clear APIs such as:

GET    /api/content
POST   /api/content
GET    /api/content/:id
PATCH  /api/content/:id
DELETE /api/content/:id

POST   /api/files/upload
GET    /api/files/:id
DELETE /api/files/:id

GET    /api/folders
POST   /api/folders
PATCH  /api/folders/:id
DELETE /api/folders/:id

GET    /api/health

Adapt naming to the actual implementation.

45. WEBSOCKET EVENTS

Define events similar to:

CONTENT_CREATED
CONTENT_UPDATED
CONTENT_DELETED

FILE_CREATED
FILE_DELETED

FOLDER_CREATED
FOLDER_UPDATED
FOLDER_DELETED

SYNC_REQUIRED

DEVICE_CONNECTED
DEVICE_DISCONNECTED

Each event should contain enough information for clients to synchronize safely.

Example:

{
  "type": "CONTENT_UPDATED",
  "id": "content_123",
  "version": 4
}
46. INITIAL SYNC

When a new device joins:

New Device
    ↓
Connect
    ↓
Request current state
    ↓
Server reads persistent storage
    ↓
Return current state
    ↓
Client renders
    ↓
WebSocket subscription begins

Do not try to reconstruct the entire shared space from other browsers.

47. SEARCH AND FILTER

Provide:

Search
Filter by type
Sort by newest
Sort by oldest
Sort by updated
Filter files
Filter notes
Filter links

Search must operate against authoritative server data.

For small datasets, server/API search is sufficient.

48. RESPONSIVE DESIGN

The UI must work on:

Desktop
Laptop
Tablet
Mobile

The same shared space should be usable on:

Chrome
Firefox
Safari
Mobile browsers

where technically supported.

49. VISUAL DESIGN

Use a modern, clean interface.

Principles:

Minimal
Fast
Friendly
Clear hierarchy
Strong typography
Consistent spacing
Accessible contrast
Responsive
Touch friendly

Use:

Tailwind CSS
shadcn/ui
Lucide Icons

Animations should be purposeful.

Use:

Framer Motion / GSAP

for:

Card appearance
Modal transitions
Upload progress
Drag/drop feedback
Connection status
Content updates

Do not over-animate productivity workflows.

50. ACCESSIBILITY

Support:

Keyboard navigation
Focus states
Screen readers
Semantic HTML
Proper labels
Accessible dialogs
Accessible buttons
Color-independent status indicators
51. PERFORMANCE

Optimize:

File upload
Large file handling
Rendering many content cards
WebSocket updates
Search
Image previews
Memory usage

Do not reload the entire content list after every small WebSocket event.

Use targeted updates:

CREATE → add item
UPDATE → update item
DELETE → remove item
52. IMPORTANT ANTI-PATTERNS

DO NOT implement:

❌ localStorage as shared database
❌ WebSocket as permanent storage
❌ WebRTC as the only persistence layer
❌ uploader browser as file owner
❌ React state as source of truth
❌ delete only from frontend
❌ content tied to browser session
❌ refresh causing data reset
❌ disconnect deleting uploaded content
❌ mandatory account system
❌ fake offline persistence
53. CORRECT ARCHITECTURE

The final architecture should conceptually be:

                         LOCAL WIFI / LAN

       ┌────────────┐       ┌────────────┐
       │  Laptop A  │       │   Phone B  │
       │  Browser   │       │  Browser   │
       └─────┬──────┘       └──────┬─────┘
             │                     │
             └──────────┬──────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │    LOCAL HOST        │
             │                     │
             │   Next.js / API     │
             │   WebSocket         │
             │                     │
             │   SQLite            │
             │   File Storage      │
             └──────────┬──────────┘
                        │
                 ┌──────┴──────┐
                 ▼             ▼
              SQLite       Filesystem
              Metadata      Files
54. SIMPLE MENTAL MODEL

Use this principle throughout development:

DATABASE
"What exists?"

FILE STORAGE
"Where is the actual file?"

API
"Can I create/change/delete it?"

WEBSOCKET
"Who needs to know that it changed?"

BROWSER
"How do I display it?"
55. EXAMPLE COMPLETE FLOW
User A creates a note
User A
   │
   │ "Meeting at 3 PM"
   ▼
POST /api/content
   │
   ▼
SQLite
   │
   │ saved
   ▼
WebSocket
   │
   ├────────► User B
   └────────► User C

Everyone sees:

📝 Meeting at 3 PM
User A refreshes
Browser refresh
      ↓
GET /api/content
      ↓
SQLite
      ↓
Meeting at 3 PM

It remains.

User A closes browser
Browser closed
      ↓
SQLite still contains content

It remains.

User B deletes it
User B
   ↓
DELETE /api/content/123
   ↓
SQLite
   ↓
WebSocket
   ├──► User A
   └──► User C

Everyone sees it disappear.

User A refreshes again
Refresh
   ↓
SQLite
   ↓
Content 123 is deleted
   ↓
Does not appear
56. DEVELOPMENT PROCESS

Do not immediately start by building random UI components.

Follow this order:

Phase 1 — Architecture

Define:

System architecture
Network model
Data model
API model
WebSocket model
Storage model
Phase 2 — Persistent Backend

Implement:

SQLite
migrations
content CRUD
file storage
upload/download
validation
Phase 3 — Real-Time Layer

Implement:

WebSocket server
events
reconnect
initial synchronization
conflict handling
Phase 4 — Frontend

Implement:

shared-space UI
content cards
add content
edit
delete
upload
download
Phase 5 — UX

Implement:

responsive design
animations
loading states
errors
connection status
drag/drop
Phase 6 — Testing

Test:

multi-device
refresh
reconnect
browser close
server restart
edit
delete
file upload
large files
concurrent changes
Phase 7 — Deployment

Provide:

local host setup
environment configuration
database initialization
storage initialization
LAN access
backup/restore
production start command
57. REQUIRED DOCUMENTATION

Create documentation explaining:

README.md
ARCHITECTURE.md
API.md
DATABASE.md
WEBSOCKET.md
DEPLOYMENT.md
TESTING.md
SECURITY.md

Documentation should explain the system in simple language.

Include diagrams.

58. REQUIRED FINAL DELIVERABLE

The final implementation must provide:

Core
✅ Local LAN sharing
✅ No mandatory login
✅ Shared persistent content
✅ Text sharing
✅ Link sharing
✅ File sharing
✅ Image/document support
✅ Folders
✅ Edit
✅ Delete
✅ Download
Persistence
✅ Refresh persistence
✅ Browser-close persistence
✅ Uploader-disconnect persistence
✅ Server-restart persistence
Synchronization
✅ WebSocket real-time updates
✅ Multi-device synchronization
✅ Reconnection
✅ Initial synchronization
Security
✅ Input validation
✅ File validation
✅ Path traversal protection
✅ Safe file serving
✅ Rate limiting where appropriate
✅ Honest LAN security warning
UX
✅ Responsive
✅ Modern
✅ Accessible
✅ Mobile friendly
✅ Desktop friendly
✅ Clear connection status
✅ Upload progress
✅ Error states
59. FINAL ACCEPTANCE CRITERIA

The system is NOT considered complete unless all of the following are true:

[ ] Two devices on same Wi-Fi can connect.

[ ] No user account is required.

[ ] User A can create content.

[ ] User B immediately sees it.

[ ] User A can edit it.

[ ] User B sees the edit.

[ ] User B can delete it.

[ ] User A sees the deletion.

[ ] Refresh does not delete content.

[ ] Closing browser does not delete content.

[ ] Uploader disconnecting does not delete content.

[ ] Server restart does not delete content.

[ ] Deleted content does not return after refresh.

[ ] Uploaded files remain after uploader disconnects.

[ ] Multiple devices remain synchronized.

[ ] WebSocket failure does not destroy persisted data.

[ ] Reconnection restores current authoritative state.

[ ] Database is the metadata source of truth.

[ ] Filesystem is the file source of truth.

[ ] Browser storage is NOT the shared source of truth.

[ ] WebSocket is NOT treated as persistent storage.

[ ] WebRTC, if used, is NOT the only persistence mechanism.

[ ] UI reflects actual server state.

[ ] No fake success messages.

[ ] LAN security limitations are clearly communicated.
60. FINAL PRODUCT PHILOSOPHY

Do not turn this project into a traditional cloud drive.

Do not make users think:

Create account
→ Verify email
→ Login
→ Create workspace
→ Invite users
→ Upload

Instead, the experience should be:

Connect to Wi-Fi
       ↓
Open local shared space
       ↓
See shared content
       ↓
Add / Edit / Delete
       ↓
Everyone nearby sees it
       ↓
Refresh
       ↓
Everything is still there

The fundamental principle is:

Content belongs to the Shared Space, not to the browser, device session, or uploader.

And the fundamental technical principle is:

Persistent local storage is the source of truth; WebSocket provides real-time synchronization; the browser is only a client.

Build the system around these principles from the beginning and do not introduce architecture that contradicts them.