# Intro Microbes

Interactive microbiology module with required Google sign-in, cloud progress, immutable assessment submission, and a protected lecturer dashboard through Firebase Authentication and Cloud Firestore.

## Local setup

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. A configured Firebase project and Google sign-in are required before lesson content is available.

## Enable Google sign-in and cloud progress

1. Create a project in the [Firebase console](https://console.firebase.google.com/) and add a Web app.
2. Copy `.env.example` to `.env`, then replace its values with the matching fields from the Firebase Web app configuration. Only variables prefixed with `VITE_` are exposed to the browser.
3. In **Authentication > Sign-in method**, enable **Google**.
4. Create a **Cloud Firestore** database.
5. Add every deployed site domain under **Authentication > Settings > Authorized domains**. Localhost is normally available for development.
6. Sign in to Firebase, select the project, and deploy the private-per-user Firestore rules and built site:

```powershell
npx firebase login
npx firebase use --add
npm run deploy
```

## Authorize lecturer accounts

Lecturer access uses a Firestore allowlist. First ask the lecturer to sign in to the website once, then find their UID in **Firebase Console → Authentication → Users**.

In **Firestore Database → Data**, create:

```text
lecturers/{LECTURER_UID}
```

The document can contain a descriptive field such as `name`; its existence grants that account lecturer access. Sign out and back in after creating it. Do not add student UIDs to this collection.

Students submit to `submissions/{STUDENT_UID}`. Submission documents are immutable, and the deployed rules also block further progress changes after submission. Lecturer accounts can list and read submissions through the dashboard; students can read only their own submission.

## Commands

- `npm run dev` — start the Vite development server.
- `npm run build` — create the production site in `dist/`.
- `npm run preview` — preview the production build locally.
- `npm run typecheck` — validate the backend module syntax.
- `npm run deploy` — build and deploy hosting plus Firestore rules.
- `npm run deploy:hosting` — deploy only the site.
- `npm run deploy:rules` — deploy only Firestore rules.

The browser Firebase configuration is not a password, but `.env` is excluded from Git to keep environment-specific configuration out of the repository. Access is protected by `firestore.rules`, which permits a signed-in user to access only `users/{their-uid}/modules/*`. Restrict the Firebase API key to expected web origins in Google Cloud Console before production deployment.
