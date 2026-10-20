MASTER PROMPT: Build an IPO Social Media Poster SaaS
1. Project Overview
Build a production-oriented, responsive SaaS web application for Indian IPO distributors, financial service businesses and stock-market social media creators.
Working project name: IPO Poster Studio
The application should automatically fetch authorized IPO information from IPO Premium (https://www.ipopremium.in), display the information in a dashboard, allow users to copy formatted IPO details for WhatsApp and other social media, and generate branded IPO posters using the client's logo.
The application must have two main areas:
Admin Panel — manage users, IPO data, subscription plans, poster templates, branding rules and application settings.
Client Panel — browse IPO information, customize messages, upload their business logo, generate posters, and access subscription features.
Build a functional application, not a static UI prototype.
Do not stop after creating a plan. Inspect the environment, implement the application, run it, test it and prepare it for deployment.
2. Non-Negotiable Technical Requirements
Frontend: Next.js, TypeScript and Tailwind CSS.
Backend: Python 3.12+ with FastAPI.
Deployment: Vercel.
Architecture: separate frontend and Python API components, deployable on Vercel with a compatible project configuration.
Use the latest mutually compatible stable dependencies when implementation begins.
Use environment variables for secrets and API credentials.
Keep the project lightweight, modular, maintainable and inexpensive.
Use server-side authorization for all privileged operations.
Never expose secret keys, payment verification credentials or admin credentials in browser code.
If the complete application cannot be deployed as one Vercel project without compromises, use separate Vercel projects for the frontend and API, or document a compatible alternative. Do not silently replace the Python backend with Node.js.
3. IPO Data Source and Compliance
Primary intended source: IPO Premium website.
Before implementing any scraper:
Inspect publicly accessible pages, published terms, robots.txt and any documented API or feed.
Determine whether automated extraction and commercial redistribution are authorized.
Prefer an official API or a written-authorized feed.
If permission is required or unavailable, do not scrape or redistribute the source's content. Implement a source adapter that uses demo data or admin-entered IPO data until authorization is obtained.
Never bypass login, CAPTCHA, paywalls, anti-bot controls or other access restrictions.
Do not extract customer information, account details, private API endpoints or unrelated website content.
Do not scrape every page or repeatedly request the website.
Create a modular data-provider interface:
AuthorizedIpoProvider: connects to the approved source.
DemoIpoProvider: returns realistic sample records.
ManualIpoProvider: supports admin-entered or corrected information.
The application must work fully in demo mode even if the source is unavailable.
Only fetch IPO-related fields, including:
Company name
IPO category: Mainboard or SME
IPO opening date
IPO closing date
Allotment date, when available
Listing date, when available
Price band
Lot size
Minimum investment, if supplied or correctly calculable
Issue size
Reported GMP, if authorized and available
Subscription figures, if authorized and available
IPO status
Source URL and source attribution
Last updated timestamp
Represent missing fields as unavailable rather than inventing values.
Normalize dates, numeric fields and statuses. Validate the response before displaying or publishing the data.
Show the last successful update time and a clear stale-data warning when necessary.
Do not imply that GMP is official, guaranteed or a prediction of listing gains.
4. Client Dashboard
Build a professional dashboard with a clean white background, dark text, subtle borders and a restrained green/red financial-data accent palette.
The dashboard must include:
Sidebar or responsive navigation
Overview section
Searchable IPO list
Mainboard and SME filters
Upcoming, Open, Closed and Listed status filters
Company name search
IPO information cards or a responsive table
IPO details drawer or modal
Refresh data button
Last updated indicator
Loading skeletons
Empty states
Error states
Mobile-responsive layout
Each IPO card should display available details in a readable format.
Provide these primary actions:
Button A: Copy & Share
On clicking, open a panel with:
Copy IPO details
Copy WhatsApp-formatted message
Share via WhatsApp
Copy for Telegram
Copy for other social media
Select message language: English, Hindi or Gujarati
Generate properly formatted messages using the currently selected IPO record.
Example format:
NEW IPO — [Company Name]
IPO Dates: [Opening Date] – [Closing Date] Price Band: ₹[Lower Price] – ₹[Upper Price] Lot Size: [Lot Size] Issue Size: [Issue Size] GMP: [Reported GMP or Not Available]
For educational information only. GMP is unofficial and may change.
Source: [Source URL]
Never show invented values or unresolved template placeholders in the final copied message.
Implement the clipboard API with a fallback for unsupported browsers.
The WhatsApp action should open the official WhatsApp click-to-chat URL with URL-encoded text. It must not send messages automatically.
Button B: Create Poster
Open the poster editor for the selected IPO.
Pass the selected IPO data into the editor without requiring the user to enter all the fields again.
5. IPO Poster Generator
Create a professional social media poster editor suitable for Indian IPO businesses.
Poster customization
Allow the client to:
Upload their company logo in PNG, JPEG or WebP format.
Preview and reposition the logo.
Select from multiple poster templates.
Select a background style.
Choose from supported color themes.
Toggle available IPO fields.
Edit a business name or contact footer.
Preview the poster before export.
Download the final image as PNG.
Share or save the generated image on supported devices.
Create reusable templates such as:
Clean White Financial
Premium Corporate
Dark Market
Minimal IPO Announcement
Gujarati Business Poster
Keep typography readable, dates prominent and important details clearly aligned.
Do not use the source website's logo or copyrighted artwork without authorization. IPO company logos must be used only where permitted.
Image rendering
Use HTML/CSS templates with a reliable PNG-rendering approach.
Prefer browser-side rendering using a compatible HTML-to-image library, with correct handling of cross-origin images and uploaded logos.
Provide standard square and portrait social-media dimensions, including 1080 × 1080 and 1080 × 1350.
Use a preview that matches the downloaded image as closely as possible.
If a browser cannot support a feature, show an understandable error rather than silently exporting a broken image.
6. Free Plan and Paid Subscription
Implement two feature tiers.
Free Plan
Browse available IPO information.
Copy IPO messages.
Generate posters.
Upload a client logo.
Download posters with the platform watermark.
Access a limited selection of templates, according to admin configuration.
Watermark example:
"Created with IPO Poster Studio"
The watermark must remain legible and should not obstruct IPO details.
Paid Plan
Generate posters without the platform watermark.
Access premium templates.
Save brand preferences.
Access configurable higher usage limits.
Access additional customization features enabled by the admin.
The watermark-free feature must be authorized by the backend.
Do not rely on hiding a watermark with CSS or using a client-side subscription flag. A free user must not be able to bypass the restriction simply by modifying browser code.
For every export request, verify the user's current subscription status or signed entitlement.
7. Admin Panel
Create a protected admin area with the following pages.
Admin Overview
Display:
Total registered users
Active subscribers
Free users
Poster generations
Recent application errors
Data source health
Last successful IPO refresh
User Management
Allow authorized administrators to:
View users
Search users
View plan and account status
Activate or suspend accounts
Review subscription status
View basic usage statistics
Change a user's plan through a logged administrative action
Never display passwords, authentication tokens or payment secrets.
IPO Management
Allow the admin to:
View imported IPO records
Refresh the authorized source
Add an IPO manually
Edit incorrect details
Mark a record as verified
Change its display status
Hide a record
Inspect source attribution and update time
Manual changes should not be overwritten unexpectedly by the next automatic import.
Subscription Management
Allow the admin to:
Configure plan names and prices
Configure feature access
Configure poster limits
Configure watermark settings
Review verified payment events
Review subscription expiry
Grant or revoke a manual entitlement with an audit trail
Template Management
Allow the admin to:
Enable or disable templates
Configure template availability by plan
Set a default template
Configure the default watermark
Preview templates
Application Settings
Include:
Application name and logo
Support email
Source configuration
Data refresh interval
Default message language
Default poster dimensions
Free and paid plan settings
Maintenance mode
Only authorized admins can access these controls.
8. Authentication and Data Storage
The preferred MVP should avoid a large database and store as little data as possible.
Use the following strategy:
No-database demo mode
The application must support a mode that works without a database.
Use demo IPO records.
Store non-sensitive UI preferences in localStorage.
Store a logo locally in the browser for the current device.
Do not pretend localStorage is secure authentication.
Do not allow localStorage to grant paid features.
Production SaaS mode
If users need accounts, persistent subscription status and cross-device access, integrate a minimal managed database and authentication provider.
Prefer a small PostgreSQL database with managed authentication, such as Supabase, if suitable for the deployment.
Keep the data model minimal:
Users
User ID
Email
Role
Account status
Created timestamp
Subscriptions
Subscription ID
User ID
Plan ID
Provider subscription reference
Subscription status
Current period end
Plans
Plan ID
Plan name
Price
Feature configuration
Brand Profiles
User ID
Business name
Logo storage reference
Selected template
Color preferences
Audit Events
Event ID
Actor ID
Action
Timestamp
Relevant non-sensitive metadata
Do not create a table for every possible UI component.
Do not persist full IPO records in the database if they can be retrieved from an authorized source or cached temporarily. Use a suitable cache or managed key-value store only when necessary.
Avoid storing uploaded logo binaries in database rows. Use browser-local storage for the MVP or object storage for persistent accounts.
Explain the limitations and costs of every external service used.
9. Payments
Design the application to support a subscription payment provider such as Razorpay, subject to account eligibility and available subscription features.
Implement the following flow:
Client selects a paid plan.
Backend creates the payment or subscription request.
Client completes payment through the provider.
Backend verifies the provider response and signature.
Webhooks are verified server-side.
Subscription status is updated only after trusted verification.
Paid features become available after verification.
Failed, expired, cancelled or refunded subscriptions are handled according to provider events and the configured policy.
Use webhook idempotency to avoid processing the same event twice.
Never store card details or trust a client-submitted payment success flag.
If payment credentials are unavailable, build a clearly labelled test mode and an admin review workflow. Do not simulate real successful payments in production.
10. Backend API Design
Use FastAPI with validated request and response schemas.
Create logical endpoints such as:
GET /api/health
GET /api/ipos
GET /api/ipos/{ipo_id}
POST /api/admin/ipos/refresh
POST /api/admin/ipos
PATCH /api/admin/ipos/{ipo_id}
GET /api/me
GET /api/plans
POST /api/billing/checkout
POST /api/billing/webhook
POST /api/posters/authorize-export
GET /api/admin/metrics
Protect admin and billing routes with server-side authentication and role checks.
Validate all input, enforce request size limits and rate-limit expensive operations.
The refresh endpoint must not be publicly available without authorization.
Do not make an external IPO source request every time a visitor loads the dashboard. Use appropriate caching, request deduplication and controlled refresh intervals.
Implement source timeouts, bounded retries and graceful fallback to the last valid response where permitted.
Do not promise real-time data when the source only updates periodically.
11. Vercel Deployment Requirements
Prepare a deployment-ready repository.
Include:
frontend/ — Next.js application
backend/ — FastAPI application
vercel.json or the appropriate supported Vercel project configuration
Python dependency manifest
Frontend package manifest
.env.example
.gitignore
README with setup and deployment instructions
API documentation
Basic automated tests
Use Vercel-compatible Python entry points and routing.
Verify the currently supported Python runtime, function limits, build settings and project configuration before finalizing the deployment files.
Do not assume that Vercel serverless functions provide persistent local files, permanent background workers or indefinitely running scraping jobs.
Do not use an endless scheduler or long-running scraper inside a request handler. If scheduled refresh is required, use a supported scheduled function or an external scheduler with authentication and appropriate plan limits.
Configure CORS to allow only the intended frontend origins.
Keep environment variables and credentials out of version control.
Provide separate instructions for local development and production deployment.
12. UI and UX Quality
The application must look like a polished modern SaaS, not a generic AI-generated dashboard.
Design requirements:
Clean white or neutral backgrounds
Strong visual hierarchy
Consistent spacing
Readable typography
Responsive desktop and mobile layouts
Reusable components
Accessible form labels
Keyboard navigation
Clear validation and error messages
Loading skeletons
Confirmation for destructive admin actions
Toast messages for copy and export actions
Empty states with useful actions
Avoid unnecessary gradients, excessive animations and cluttered cards.
Use consistent components for buttons, badges, tables, modals and form fields.
Create a professional login screen, pricing page, client dashboard, poster editor and admin dashboard.
13. Security Requirements
Protect admin routes on both frontend and backend.
Never ship admin secrets to the browser.
Verify subscription entitlements on the server.
Validate image types, image dimensions and upload sizes.
Sanitize user-provided text before rendering.
Prevent unauthorized access to other users' brand profiles.
Verify webhook signatures.
Rate-limit login, refresh, export and payment endpoints.
Avoid logging secrets or sensitive personal data.
Use HTTPS in production.
Apply secure authentication cookie settings where applicable.
Provide a basic privacy notice and data deletion workflow.
Do not collect PAN, bank account, UPI or demat details because this app does not need them.
14. Testing and Acceptance Criteria
Before declaring the MVP complete, verify all of the following:
The frontend builds successfully.
The FastAPI backend starts successfully.
The demo dashboard displays sample IPO records.
Search, category filters and status filters work.
Missing IPO fields are displayed safely.
Copying a message produces correctly formatted text.
WhatsApp sharing opens with the expected encoded message.
A poster can be generated and downloaded as a valid PNG.
The uploaded client logo appears in the poster.
Free exports include the watermark.
Paid exports are watermark-free only after server-side entitlement verification.
Unauthenticated users cannot access protected admin endpoints.
Normal clients cannot modify another client's brand profile.
Invalid payment events cannot activate a paid subscription.
The dashboard handles unavailable source data gracefully.
The authorized source adapter does not exceed its configured request limits.
The project builds and deploys using the documented Vercel setup.
No real credentials or secrets are committed.
The UI works on desktop and mobile.
All unfinished integrations are clearly labelled rather than represented as working features.
15. Required Deliverables
Produce the complete working repository with:
Full frontend source code
Full Python backend source code
Admin panel
Client dashboard
IPO provider abstraction
Demo data
Poster generator
Copy/share functionality
Free and paid feature enforcement
Minimal persistence integration for production
Payment integration scaffolding
Automated tests
Environment configuration template
Vercel deployment configuration
Setup and deployment README
List of any external accounts or permissions still required
Implementation order
Phase 1: Inspect the environment, define the architecture and confirm source access requirements.
Phase 2: Build the frontend and fully functional demo mode.
Phase 3: Implement the poster generator, message formatting and social sharing.
Phase 4: Build the FastAPI backend and authorized IPO data-provider interface.
Phase 5: Implement authentication, admin controls and minimal persistence.
Phase 6: Add server-verified subscription entitlements and payment integration.
Phase 7: Test security, functionality, performance and deployment.
At the end of each phase, run the relevant tests and fix failures before moving on.
Start with the MVP and keep the design extensible. Do not add unnecessary microservices, complex analytics or excessive data storage.
Final objective: Deliver a working, low-cost IPO Poster SaaS that fetches only authorized IPO data, makes social sharing easy, generates professional client-branded posters, and provides a genuine free-versus-paid subscription model.

