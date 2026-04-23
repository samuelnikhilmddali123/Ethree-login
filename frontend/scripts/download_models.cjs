const fs = require('fs');
const https = require('https');
const path = require('path');

const modelsDir = path.join(__dirname, '..', 'public', 'models');
const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const models = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

async function download(file) {
  const dest = path.join(modelsDir, file);
  const fileStream = fs.createWriteStream(dest);
  return new Promise((resolve, reject) => {
    https.get(baseUrl + file, (response) => {
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Downloaded ${file}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest);
      reject(err);
    });
  });
}

(async () => {
  for (const model of models) {
    try {
      await download(model);
    } catch (e) {
      console.error(`Failed to download ${model}: ${e.message}`);
    }
  }
})();
