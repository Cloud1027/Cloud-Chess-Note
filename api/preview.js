import { readFileSync } from 'fs';
import path from 'path';

// Firebase Config (Hardcoded to match client-side for now)
const FIREBASE_PROJECT_ID = "cloud-chess-note";
const FIREBASE_API_KEY = "AIzaSyArrCjf0xUCqpw4Yo2pm9fefSzNR1twgRM";

export default async function handler(req, res) {
    const { id } = req.query;

    // 1. Fetch the original index.html
    // In Vercel, we can fetch the deployment's own URL or read from file system if we know the path.
    // Using fetch is often more robust in serverless for retrieving the static asset.
    // Force production domain to avoid "Login to Vercel" on preview URLs
    const appUrl = 'https://cloud-chess-note.vercel.app';
    let html = '';

    try {
        const response = await fetch(`${appUrl}/index.html`);
        html = await response.text();
    } catch (error) {
        console.error("Failed to fetch index.html", error);
        return res.status(500).send("Internal Server Error: Could not load app template.");
    }

    // 2. If no ID, just return the app
    if (!id) {
        return res.send(html);
    }

    // 3. Fetch Game Data from Firestore (REST API)
    // URL: https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents/{collectionId}/{documentId}
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/games/${id}?key=${FIREBASE_API_KEY}`;

    let gameTitle = "Cloud Chess Note - 雲端棋譜筆記";
    let gameDesc = "隨時隨地紀錄、分析、分享您的精采對局。";

    try {
        const fsRes = await fetch(firestoreUrl);
        if (fsRes.ok) {
            const data = await fsRes.json();
            const fields = data.fields;

            // Extract Title from metadata map
            // Structure: fields -> metadata -> mapValue -> fields -> title -> stringValue
            const metadata = fields?.metadata?.mapValue?.fields;
            const fetchedTitle = metadata?.title?.stringValue;

            if (fetchedTitle) {
                gameTitle = fetchedTitle;
                // Optional: Add more details to description like Red vs Black
                const red = metadata?.red?.stringValue || "紅方";
                const black = metadata?.black?.stringValue || "黑方";
                gameDesc = `${red} vs ${black} - 點擊查看完整棋譜`;
            }
        } else {
            console.warn("Firestore fetch failed", fsRes.status);
        }
    } catch (error) {
        console.warn("Error fetching game data", error);
    }

    // 4. Inject Metadata into HTML
    const titleTag = `<title>${gameTitle}</title>`;
    const ogTitle = `<meta property="og:title" content="${gameTitle}">`;
    const ogDesc = `<meta property="og:description" content="${gameDesc}">`;
    const ogImage = `<meta property="og:image" content="${appUrl}/api/og?id=${id}">`;
    const twitterTitle = `<meta property="twitter:title" content="${gameTitle}">`;
    const twitterDesc = `<meta property="twitter:description" content="${gameDesc}">`;
    const twitterImage = `<meta property="twitter:image" content="${appUrl}/api/og?id=${id}">`;

    // Replace <title>...</title>
    html = html.replace(/<title>.*?<\/title>/, titleTag);

    // Replace Open Graph Tags
    html = html.replace(/<meta property="og:title" content=".*?">/, ogTitle);
    html = html.replace(/<meta property="og:description" content=".*?">/, ogDesc);
    html = html.replace(/<meta property="og:image" content=".*?">/, ogImage);

    // Replace Twitter Tags
    html = html.replace(/<meta property="twitter:title" content=".*?">/, twitterTitle);
    html = html.replace(/<meta property="twitter:description" content=".*?">/, twitterDesc);
    html = html.replace(/<meta property="twitter:image" content=".*?">/, twitterImage);

    // 5. Return the modified HTML
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
}
