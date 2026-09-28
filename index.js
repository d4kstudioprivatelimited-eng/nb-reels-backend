const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const cloudinary = require('cloudinary').v2; 
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); 
const os = require('os'); 

const app = express();
app.use(cors());
app.use(express.json()); // JSON data read karne ke liye (AI Support)
app.use(express.urlencoded({ extended: true }));

// ==========================================
// LIVE DEBUGGING MIDDLEWARE
// ==========================================
app.use((req, res, next) => {
    console.log("➡️ URL AAYA:", req.url);
    console.log("➡️ QUERY DATA:", req.query);
    console.log("➡️ BODY DATA:", req.body);
    next();
});

const upload = multer({ dest: '/tmp/' });

// ==========================================
// ZEGOCLOUD TOKEN API 
// ==========================================
app.get('/api/zego_token', (req, res) => {
    const appID = 871581678; 
    const serverSecret = "7cb53ea3a1e87bf816a3ac37d0fa24da"; 
    const userID = req.query.uid;
    const roomID = req.query.room;
    
    if (!userID || !roomID) return res.status(400).json({ status: 'error', message: 'Missing parameters.' });

    try {
        const expireTime = 86400; 
        const currentTime = Math.floor(Date.now() / 1000);
        const expire = currentTime + expireTime;
        
        const nonce = crypto.randomBytes(8).readBigInt64BE(0);
        const payloadObj = { room_id: roomID, privilege: { 1: 1, 2: 1 }, stream_id_list: null };
        const payload = JSON.stringify(payloadObj);
        
        const iv = crypto.randomBytes(16);
        const secretKey = crypto.createHash('md5').update(serverSecret).digest(); 
        
        const cipher = crypto.createCipheriv('aes-128-cbc', secretKey, iv);
        let encrypted = cipher.update(payload, 'utf8', 'binary');
        encrypted += cipher.final('binary');
        
        const encryptedBuffer = Buffer.from(encrypted, 'binary');
        const b1 = Buffer.alloc(8); b1.writeBigInt64BE(BigInt(expire), 0);
        const b2 = Buffer.alloc(4); b2.writeUInt32BE(iv.length, 0);
        const b3 = iv;
        const b4 = Buffer.alloc(2); b4.writeUInt16BE(encryptedBuffer.length, 0);
        const b5 = encryptedBuffer;
        
        const pkg = Buffer.concat([b1, b2, b3, b4, b5]);
        const token = '04' + pkg.toString('base64');

        res.json({ status: 'success', token: token });
    } catch (error) {
        console.error("❌ Zego Token Generation Error:", error.message);
        res.status(500).json({ status: 'error', message: 'Failed to connect to Live Server.' });
    }
});

// ==========================================
// CONFIGURATION
// ==========================================
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = 'imtiyaz6201260615@gmail.com';
const SENDER_NAME = 'NB Reels App';
const FIREBASE_DB_URL = 'https://public-real-default-rtdb.firebaseio.com/';

// ⚠️ Yahan pehle account mein apni Cloudinary ki NUMERIC api_key zaroor daal lein
const cloudinary_accounts = [
    { cloud_name: 'mediaflows_f2ed0bf1', api_key: 'dl3fkAVqga2vQLb92SHl0Sjol7Q', api_secret: 'yE6VnLHL_hqki-xwKCuen17X_ZY' },
    { cloud_name: 'demo_cloud_2', api_key: 'demo_key_2', api_secret: 'demo_secret_2' },
    { cloud_name: 'demo_cloud_3', api_key: 'demo_key_3', api_secret: 'demo_secret_3' },
    { cloud_name: 'demo_cloud_4', api_key: 'demo_key_4', api_secret: 'demo_secret_4' },
    { cloud_name: 'demo_cloud_5', api_key: 'demo_key_5', api_secret: 'demo_secret_5' },
    { cloud_name: 'demo_cloud_6', api_key: 'demo_key_6', api_secret: 'demo_secret_6' },
    { cloud_name: 'demo_cloud_7', api_key: 'demo_key_7', api_secret: 'demo_secret_7' },
    { cloud_name: 'demo_cloud_8', api_key: 'demo_key_8', api_secret: 'demo_secret_8' },
    { cloud_name: 'demo_cloud_9', api_key: 'demo_key_9', api_secret: 'demo_secret_9' },
    { cloud_name: 'demo_cloud_10', api_key: 'demo_key_10', api_secret: 'demo_secret_10' },
    { cloud_name: 'demo_cloud_11', api_key: 'demo_key_11', api_secret: 'demo_secret_11' },
    { cloud_name: 'demo_cloud_12', api_key: 'demo_key_12', api_secret: 'demo_secret_12' },
    { cloud_name: 'demo_cloud_13', api_key: 'demo_key_13', api_secret: 'demo_secret_13' },
    { cloud_name: 'demo_cloud_14', api_key: 'demo_key_14', api_secret: 'demo_secret_14' },
    { cloud_name: 'demo_cloud_15', api_key: 'demo_key_15', api_secret: 'demo_secret_15' },
    { cloud_name: 'demo_cloud_16', api_key: 'demo_key_16', api_secret: 'demo_secret_16' },
    { cloud_name: 'demo_cloud_17', api_key: 'demo_key_17', api_secret: 'demo_secret_17' },
    { cloud_name: 'demo_cloud_18', api_key: 'demo_key_18', api_secret: 'demo_secret_18' },
    { cloud_name: 'demo_cloud_19', api_key: 'demo_key_19', api_secret: 'demo_secret_19' },
    { cloud_name: 'demo_cloud_20', api_key: 'demo_key_20', api_secret: 'demo_secret_20' }
];

// ==========================================
// DATABASE SETUP
// ==========================================
const db = new sqlite3.Database('/tmp/server_security.sqlite');
db.run(`CREATE TABLE IF NOT EXISTS otp_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    email TEXT NOT NULL, 
    otp TEXT NOT NULL, 
    request_time INTEGER NOT NULL, 
    ip_address TEXT NOT NULL
)`);

const getQuery = (query, params) => new Promise((res, rej) => db.get(query, params, (err, row) => err ? rej(err) : res(row)));
const runQuery = (query, params) => new Promise((res, rej) => db.run(query, params, function(err) { err ? rej(err) : res(this); }));

// ==========================================
// API ROUTING
// ==========================================
app.all('/', upload.any(), async (req, res) => {
    const action = req.query.action || req.body.action;
    const ip_address = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    try {
        switch (action) {

            // --- 1. ADMIN PANEL SERVER STATS ---
            case 'server_stats': {
                const totalMem = os.totalmem(); 
                const freeMem = os.freemem(); 
                const usedMem = totalMem - freeMem;
                const ramUsagePercentage = ((usedMem / totalMem) * 100).toFixed(2);
                
                let usedStorageGB = 0;
                try {
                    const dbRes = await axios.get(`${FIREBASE_DB_URL}videos.json?shallow=true`);
                    const totalVideos = dbRes.data ? Object.keys(dbRes.data).length : 0;
                    usedStorageGB = (totalVideos * 5) / 1024; 
                } catch(e) {
                    console.error("⚠️ Storage Calc Error:", e.message);
                }
                
                return res.json({ 
                    status: "success", 
                    ram_usage: `${ramUsagePercentage}%`, 
                    used_mb: (usedMem / 1024 / 1024).toFixed(0), 
                    total_mb: (totalMem / 1024 / 1024).toFixed(0), 
                    storage_gb: (500 - usedStorageGB).toFixed(2) 
                });
            }

            // --- 2. AI CUSTOMER SUPPORT ---
            case 'ai_support': {
                const userMessage = req.body.message;
                console.log("🤖 AI Ke Liye Message Aaya:", userMessage);
                
                if (!userMessage) return res.json({ status: "error", message: "No message received." });

                try {
                    const aiResponse = await axios.post('https://mr4k09.alwaysdata.net/index.php', {
                        prompt: userMessage,
                        isImageRequest: false,
                        imageBase64: null
                    }, {
                        headers: { 
                            'Content-Type': 'application/json', 
                            'Authorization': 'Bearer D4K-AIU6WD4D1FEJ' 
                        }
                    });
                    
                    let aiText = aiResponse.data.response || aiResponse.data.reply || aiResponse.data.answer || (typeof aiResponse.data === 'string' ? aiResponse.data : JSON.stringify(aiResponse.data));
                    console.log("✅ AI Reply Bheja Gaya:", aiText);
                    return res.json({ status: "success", reply: aiText });
                } catch (error) {
                    console.error("❌ AI API Error:", error.response ? error.response.data : error.message);
                    return res.json({ status: "error", message: "AI Server abhi busy hai." });
                }
            }

            // --- 3. REQUEST OTP (Full Company Details) ---
            case 'request_otp': {
                const email = req.body.email;
                if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.json({ status: "error", message: "Invalid email address." });

                const lastRequest = await getQuery(`SELECT request_time FROM otp_requests WHERE email = ? ORDER BY request_time DESC LIMIT 1`, [email]);
                const currentTime = Math.floor(Date.now() / 1000);

                if (lastRequest && (currentTime - lastRequest.request_time) < 60) return res.json({ status: "error", message: "Please wait 60 seconds." });

                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                await runQuery(`INSERT INTO otp_requests (email, otp, request_time, ip_address) VALUES (?, ?, ?, ?)`, [email, otp, currentTime, ip_address]);

                const emailTemplate = `
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;'>
                        <div style='background-color: #f9f9f9; padding: 25px;'>
                            <h2 style='color: #0095f6; text-align: center; margin-top: 0;'>NB Reels App</h2>
                            <p style='color: #333;'>Hello,</p>
                            <p style='color: #333;'>Aapka secure Login OTP niche diya gaya hai:</p>
                            
                            <div style='text-align: center; margin: 25px 0;'>
                                <span style='font-size: 26px; font-weight: bold; background: #000; color: #fff; padding: 12px 25px; border-radius: 6px; letter-spacing: 4px;'>${otp}</span>
                            </div>
                            <p style='font-size: 13px; color: #ff3b30; text-align: center;'>Yeh OTP 5 minute ke liye valid hai.</p>
                        </div>
                        
                        <div style='background-color: #fff; padding: 20px; border-top: 1px solid #ddd; font-size: 13px; color: #555; line-height: 1.6;'>
                            <strong style='font-size: 15px; color: #000;'>D 4K Studio Private Limited</strong><br>
                            <strong>Address:</strong> Naya Basti Bokaro Thermal jharkhand india<br>
                            <strong>Website:</strong> <a href='https://mr4k09.000.pe/?i=1' style='color: #0095f6;'>https://mr4k09.000.pe/?i=1</a><br>
                            <strong>Contact:</strong> 9430320021<br>
                            <strong>Developer:</strong> Danish Raza ji
                            
                            <p style='text-align: center; font-size: 14px; font-weight: bold; color: #0095f6; margin-top: 20px; margin-bottom: 0;'>
                                Thank u for use India's number one reel app
                            </p>
                        </div>
                    </div>
                `;

                await axios.post('https://api.brevo.com/v3/smtp/email', {
                    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                    to: [{ email: email }],
                    subject: "Your Login OTP - NB Reels App",
                    htmlContent: emailTemplate
                }, { headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' } });

                console.log("✅ OTP Sent to:", email);
                return res.json({ status: "success", message: "OTP sent successfully." });
            }

            // --- 4. VERIFY OTP ---
            case 'verify_otp': {
                const { email, otp } = req.body;
                const record = await getQuery(`SELECT * FROM otp_requests WHERE email = ? AND otp = ? ORDER BY request_time DESC LIMIT 1`, [email, otp]);

                if (record) {
                    const currentTime = Math.floor(Date.now() / 1000);
                    if ((currentTime - record.request_time) > 300) return res.json({ status: "error", message: "OTP has expired." });
                    else return res.json({ status: "success", message: "OTP verified successfully." });
                } else {
                    return res.json({ status: "error", message: "Invalid OTP. Please try again." });
                }
            }

            // --- 5. UPLOAD VIDEO (With Detailed Debugging) ---
            case 'upload_video': {
                const videoFile = req.files ? req.files.find(f => f.fieldname === 'video_file') : null;
                if (!videoFile) return res.json({ status: "error", message: "No video file selected." });

                let finalVideoUrl = ""; let usedAccount = ""; let uploadSuccess = false;

                for (let account of cloudinary_accounts) {
                    if (account.cloud_name.startsWith('demo_')) continue;
                    try {
                        cloudinary.config({ cloud_name: account.cloud_name, api_key: account.api_key, api_secret: account.api_secret, secure: true });
                        const result = await cloudinary.uploader.upload(videoFile.path, { resource_type: "video", folder: "nb_reels_videos", timeout: 120000 });
                        finalVideoUrl = result.secure_url; usedAccount = account.cloud_name; uploadSuccess = true; 
                        console.log("✅ Video Uploaded to Cloudinary:", finalVideoUrl);
                        break; 
                    } catch (err) { 
                        console.error(`❌ Cloudinary Video Upload Error (${account.cloud_name}):`, err.message);
                        continue; 
                    }
                }
                if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path); 
                if (!uploadSuccess) return res.json({ status: "error", message: "Server storage full or Invalid Cloudinary Key." });

                const video_id = Date.now().toString();
                const uploader_uid = req.body.uploader_uid || 'unknown';

                await axios.put(`${FIREBASE_DB_URL}videos/${video_id}.json`, {
                    video_url: finalVideoUrl, hosted_on: usedAccount, uploader_uid: uploader_uid,
                    metrics: { views: 0, likes: 0, shares: 0, comments: 0 },
                    timestamp: Math.floor(Date.now() / 1000)
                });
                return res.json({ status: "success", video_id: video_id, message: "Video uploaded successfully." });
            }

            // --- 6. UPLOAD DP (With Detailed Debugging) ---
            case 'upload_dp': {
                const dpFile = req.files ? req.files.find(f => f.fieldname === 'dp_file') : null;
                if (!dpFile) return res.json({ status: "error", message: "No image file selected." });

                let finalDpUrl = ""; let uploadSuccess = false;

                for (let account of cloudinary_accounts) {
                    if (account.cloud_name.startsWith('demo_')) continue;
                    try {
                        cloudinary.config({ cloud_name: account.cloud_name, api_key: account.api_key, api_secret: account.api_secret, secure: true });
                        const result = await cloudinary.uploader.upload(dpFile.path, { resource_type: "image", folder: "nb_reels_dp" });
                        finalDpUrl = result.secure_url; uploadSuccess = true; 
                        console.log("✅ DP Uploaded to Cloudinary:", finalDpUrl);
                        break;
                    } catch (err) { 
                        console.error(`❌ Cloudinary DP Upload Error (${account.cloud_name}):`, err.message);
                        continue; 
                    }
                }
                if (fs.existsSync(dpFile.path)) fs.unlinkSync(dpFile.path);
                if (!uploadSuccess) return res.json({ status: "error", message: "Server storage full or Invalid Cloudinary Key." });
                return res.json({ status: "success", dp_url: finalDpUrl, message: "Profile picture updated." });
            }

            default: return res.json({ status: "error", message: "Invalid request." });
        }
    } catch (err) {
        console.error("🚨 CRITICAL SERVER ERROR:", err.response ? err.response.data : err.message);
        return res.json({ status: "error", message: "Network error. Please try again." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`🚀 Node.js server running smoothly on port ${PORT}`); });
