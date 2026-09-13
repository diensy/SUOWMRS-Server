import mongoose from 'mongoose';
import dns from 'dns';

// Fix Node 20+ DNS resolution order on cloud containers (Render, Railway)
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignore if unsupported
}

export const connectDB = async (retryCount = 0) => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/suowmrs';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      family: 4,
    });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`[MongoDB Warning] Connection attempt ${retryCount + 1} failed: ${error.message}`);
    if (retryCount < 5) {
      console.log(`[MongoDB] Retrying connection in 3 seconds...`);
      await new Promise((res) => setTimeout(res, 3000));
      return connectDB(retryCount + 1);
    }
  }
};
