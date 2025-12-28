# Deployment Guide: Cloud Chess Note

## Summary
The project is configured for Vercel deployment. Because this is a React Single Page Application (SPA), we use "Client-Side Rendering".
To support **LINE/Facebook Previews**, we have added static Open Graph metadata to `index.html` and a default preview image.

## Part 1: GitHub Push

1.  Open your terminal in `c:\vschess-master\cloud-chess-note`.
2.  Run the following Git commands to save your changes:

    ```bash
    git add .
    git commit -m "Prepare for Vercel: Added OG Tags and deployment config"
    ```

3.  **Push to GitHub**:
    *   Create a new repository on GitHub (e.g., `cloud-chess-note`).
    *   Connect and push:
        ```bash
        git remote add origin https://github.com/<YOUR-USERNAME>/cloud-chess-note.git
        git branch -M main
        git push -u origin main
        ```

## Part 2: Vercel Deployment

1.  Log in to [Vercel](https://vercel.com).
2.  Click **Add New Project**.
3.  Import your `cloud-chess-note` repository.
4.  **Project Settings**:
    *   **Framework Preset**: Vite (should be auto-detected).
    *   **Root Directory**: Ensure it points to `cloud-chess-note` if your repo has subfolders.
    *   **Build Command**: `npm run build`.
    *   **Output Directory**: `dist`.
5.  Click **Deploy**.

## Part 3: Firebase Configuration (Crucial!)

Once deployed, your app will have a new domain (e.g., `cloud-chess-note.vercel.app`). Firebase will block logins from this new domain by default.

1.  Go to [Firebase Console](https://console.firebase.google.com).
2.  Select your project.
3.  Navigate to **Authentication** > **Settings** > **Authorized Domains**.
4.  Click **Add Domain** and paste your Vercel URL (without `https://`).

## Part 4: Testing Sharing

1.  Open your Vercel App URL.
2.  Save a game to the cloud.
3.  Copy the Share Link.
4.  Paste it into LINE.
    *   **Expected Result**: You should see the "Cloud Chess Note" bold title and a preview image of the chessboard.
