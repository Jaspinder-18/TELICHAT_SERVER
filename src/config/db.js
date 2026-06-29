import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'enterprise_chat'
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Drop legacy settings key_1 index if it exists
    try {
      const db = mongoose.connection.db;
      await db.collection('settings').dropIndex('key_1');
      console.log('Successfully dropped legacy settings key_1 index.');
    } catch (indexError) {
      // Safely ignore if the index doesn't exist on this database
    }
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
