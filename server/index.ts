import app, { expireOldOrders } from './app';

const PORT = Number(process.env.PORT) || 4000;

setInterval(() => expireOldOrders().catch(console.error), 60_000);
app.listen(PORT, () => console.log(`Server on port ${PORT}`));