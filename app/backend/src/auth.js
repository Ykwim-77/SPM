import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

export const prisma = new PrismaClient();

const STAFF_SECRET = process.env.JWT_SECRET_STAFF || process.env.JWT_SECRET || "dev-staff-secret";
const PATIENT_SECRET = process.env.JWT_SECRET_PATIENT || process.env.JWT_SECRET || "dev-patient-secret";
const STAFF_TTL = process.env.JWT_EXPIRES_IN_STAFF || "8h";

export const signToken = (u, kind = "staff") => {
  const secret = kind === "patient" ? PATIENT_SECRET : STAFF_SECRET;
  const ttl = kind === "patient" ? process.env.JWT_EXPIRES_IN_PATIENT || "30d" : STAFF_TTL;
  return jwt.sign({ sub: u.id, email: u.email, role: u.role }, secret, { expiresIn: ttl });
};

export async function requireAuth(req, res, next) {
  let token = req.cookies?.access_token;
  if (!token && req.headers.authorization?.startsWith("Bearer "))
    token = req.headers.authorization.slice(7);
  if (!token) return res.status(401).json({ detail: "Não autenticado" });
  try {
    const p = jwt.verify(token, STAFF_SECRET);
    const user = await prisma.user.findUnique({ where: { id: p.sub } });
    if (!user) return res.status(401).json({ detail: "Usuário não encontrado" });
    req.user = user;
    next();
  } catch {
    try {
      const p = jwt.verify(token, PATIENT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: p.sub } });
      if (!user) return res.status(401).json({ detail: "Usuário não encontrado" });
      req.user = user;
      next();
    } catch {
      res.status(401).json({ detail: "Token inválido" });
    }
  }
}

export const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return res.status(403).json({ detail: "Acesso negado" });
  next();
};

export async function audit(user, action, target = "", details = {}) {
  const timestamp = new Date().toISOString();
  const fullDetails = {
    ...details,
    timestamp,
    action,
    target,
    user: { id: user.id, name: user.name, role: user.role },
  };

  await prisma.auditLog.create({ data: {
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action,
    target,
    details: JSON.stringify(fullDetails),
  }});
}
