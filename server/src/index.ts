import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { router } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3456;

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', router);

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('请先运行 npm run build 构建前端');
  });
});

app.listen(PORT, () => {
  console.log(`MoneyBack 服务运行在 http://localhost:${PORT}`);
});
