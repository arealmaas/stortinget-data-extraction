import { MongoClient } from 'mongodb';

export const getMongo = async () => {
  const mongodbClient = await MongoClient.connect('mongodb://localhost:27018', {
    useNewUrlParser: true,
    reconnectTries: 10,
    reconnectInterval: 1000,
    socketTimeoutMS: 15 * 60 * 1000, // 15 minutes timeout
  });

  return {
    mongodbClient,
    publicationCollection: mongodbClient
      .db('oda-test')
      .collection('publication'),
    speechCollection: mongodbClient.db('oda-test').collection('speech'),
  };
};
