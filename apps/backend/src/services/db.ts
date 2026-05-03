import mongoose from 'mongoose';

const connectDB = async (mongoUri: string) => {
  try {
    await mongoose.connect(mongoUri, {});
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
};

export default connectDB;