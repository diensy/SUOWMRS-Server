import mongoose from 'mongoose';
import dns from 'dns';

// Force Node.js DNS resolver to use Google Public DNS & Cloudflare DNS
// Fixes querySrv ENOTFOUND _mongodb._tcp issues on Linux cloud containers (Render, AWS, Railway)
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  console.warn('[DNS Warning] Custom DNS set failed:', e.message);
}

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

export const connectDB = async (retryCount = 0) => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/suowmrs';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(`[MongoDB Warning] Connection attempt ${retryCount + 1} failed: ${error.message}`);
    if (retryCount < 5) {
      console.log(`[MongoDB] Retrying connection in 3 seconds...`);
      await new Promise((res) => setTimeout(res, 3000));
      return connectDB(retryCount + 1);
    }
  }
};
