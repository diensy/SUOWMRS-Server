import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/suowmrs';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 7000,
    });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`[MongoDB Warning] Could not connect to MongoDB Atlas: ${error.message}`);
    console.warn(`[MongoDB Tip] Ensure your current IP address is whitelisted in MongoDB Atlas Network Access.`);
  }
};
