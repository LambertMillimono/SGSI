import cors from 'cors'

// Allow all origins — this server only binds to local network (0.0.0.0)
// and is only accessible within the school's Wi-Fi network
export const corsMiddleware = cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})
