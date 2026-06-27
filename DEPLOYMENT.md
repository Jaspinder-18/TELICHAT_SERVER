# Deployment Guide - Live on Render

This guide outlines how to deploy both the **Client (Frontend)** and the **Server (Backend)** to Render, using MongoDB Atlas and Cloudinary for persistent storage.

---

## ⚙️ Prerequisites

1.  **MongoDB Atlas connection string**:
    `mongodb+srv://TELICHAT:aACCvTUnWZYihV0m@mycluster.dmdcesu.mongodb.net/?appName=enterprise_chat`
2.  **Cloudinary keys**:
    *   `CLOUDINARY_CLOUD_NAME=mychatend`
    *   `CLOUDINARY_API_KEY=734128158233238`
    *   `CLOUDINARY_API_SECRET=AOesnO2ZW89Z5iU7aAQ-NOI53Bs`

---

## 🚀 Step 1: Push Code to GitHub

Since Windows Git uses a graphical window (Git Credential Manager) to log in, you should run the push commands directly in your own terminal to authorize the push.

1.  **Push Client**:
    Open a terminal, navigate to `client/` and run:
    ```bash
    git push -u origin main
    ```
2.  **Push Server**:
    Open a terminal, navigate to `server/` and run:
    ```bash
    git push -u origin main
    ```

---

## 🖥️ Step 2: Deploy Server on Render (Web Service)

1.  Log in to your [Render Dashboard](https://dashboard.render.com).
2.  Click **New +** and select **Web Service**.
3.  Connect your GitHub repository: `https://github.com/Jaspinder-18/TELICHAT_SERVER.git`.
4.  Configure the service details:
    *   **Name**: `telichat-server` (or any name you prefer)
    *   **Environment**: `Node`
    *   **Region**: Select the region closest to you
    *   **Branch**: `main`
    *   **Build Command**: `npm install`
    *   **Start Command**: `npm start`
5.  Scroll down to **Advanced** -> **Add Environment Variable** and define:
    *   `PORT` = `5000`
    *   `MONGODB_URI` = `mongodb+srv://TELICHAT:aACCvTUnWZYihV0m@mycluster.dmdcesu.mongodb.net/?appName=enterprise_chat`
    *   `CLOUDINARY_CLOUD_NAME` = `mychatend`
    *   `CLOUDINARY_API_KEY` = `734128158233238`
    *   `CLOUDINARY_API_SECRET` = `AOesnO2ZW89Z5iU7aAQ-NOI53Bs`
    *   `JWT_SECRET` = `supersecretjwtkeyforofficechat2026!`
    *   `JWT_REFRESH_SECRET` = `supersecretrefreshjwtkeyforofficechat2026!`
    *   `JWT_EXPIRY` = `15m`
    *   `JWT_REFRESH_EXPIRY` = `7d`
    *   `NODE_ENV` = `production`
    *   `CLIENT_URL` = `https://your-client-name.onrender.com` (Replace with your actual Client Static Site Live URL)
    *   `SMTP_HOST` = `smtp.gmail.com`
    *   `SMTP_PORT` = `587`
    *   `SMTP_USER` = `softwaremukti281@gmail.com`
    *   `SMTP_PASS` = `eypfqahjxzdrfetv`
    *   `SMTP_FROM` = `"Enterprise Office Chat" <noreply@officechat.com>`
6.  Click **Create Web Service**.
7.  Once deployed, copy the **Live URL** (e.g. `https://telichat-server.onrender.com`). You will need this for the Client.

---

## 🌐 Step 3: Deploy Client on Render (Static Site)

1.  In Render Dashboard, click **New +** and select **Static Site**.
2.  Connect your GitHub repository: `https://github.com/Jaspinder-18/TELICHAT_CLIENT.git`.
3.  Configure details:
    *   **Name**: `telichat` (or any name you prefer)
    *   **Branch**: `main`
    *   **Build Command**: `npm run build`
    *   **Publish Directory**: `dist`
4.  Add the following Environment Variables in the client static site settings:
    *   `VITE_API_URL` = `https://your-server-name.onrender.com/api` (Replace with your actual server Live URL + `/api`)
    *   `VITE_SOCKET_URL` = `https://your-server-name.onrender.com` (Replace with your actual server Live URL)
5.  Click **Create Static Site**.

### ⚠️ IMPORTANT: Configure Client Route Rewrites (Redirects)
Since the React frontend uses client-side routing (Vite React Router), reloading any page (like `/chats` or `/settings`) on a static host will return a `404 Not Found` error. To fix this:
1.  Go to your Client static site settings in Render.
2.  Click on the **Redirects/Rewrites** tab on the left menu.
3.  Click **Add Rule**.
4.  Configure:
    *   **Source**: `/*`
    *   **Destination**: `/index.html`
    *   **Action**: `Rewrite` (Status: `200`)
5.  Save the changes.

---

## 🚀 Step 4: Verification

1.  Open your deployed Client Static Site URL in the browser (e.g. `https://telichat.onrender.com`).
2.  Register a new account or log in.
3.  Upload a file or profile photo.
4.  Verify that it gets uploaded to Cloudinary persistently and does not disappear when Render containers restart!
