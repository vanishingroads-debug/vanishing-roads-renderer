const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');

const app = express();
const upload = multer({ dest: '/tmp' });

const PORT = process.env.PORT || 3000;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

app.get('/', (req, res) => {
  res.send('Vanishing Roads Renderer is running.');
});

app.post('/render', upload.single('audio_file'), async (req, res) => {
  const title = req.body.title;
  const audioPath = req.file.path;

  try {
    const pexelsResponse = await axios.get(
      'https://api.pexels.com/videos/search?query=dark+fog+forest+night&per_page=5&orientation=portrait',
      { headers: { Authorization: PEXELS_API_KEY } }
    );

    const videoFiles = pexelsResponse.data.videos[0].video_files;
    const videoFile = videoFiles.find(f => f.quality === 'hd') || 
                      videoFiles.find(f => f.quality === 'sd') || 
                      videoFiles[0];
    const videoUrl = videoFile.link;

    const bgPath = path.join('/tmp', 'background.mp4');
    const bgResponse = await axios.get(videoUrl, { 
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: { 'User-Agent': 'VanishingRoads/1.0' }
    });
    fs.writeFileSync(bgPath, bgResponse.data);

    const outputPath = path.join('/tmp', 'output.mp4');

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(bgPath)
        .inputOptions(['-stream_loop -1'])
        .input(audioPath)
        .outputOptions([
          '-c:v libx264',
          '-c:a aac',
          '-shortest',
          '-vf scale=1080:1920,setsar=1',
          '-r 30',
          '-preset ultrafast'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg stderr:', stderr);
          reject(err);
        })
        .run();
    });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
    fs.createReadStream(outputPath).pipe(res);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Renderer running on port ${PORT}`);
});
