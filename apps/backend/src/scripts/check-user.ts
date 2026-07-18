import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
async function main() {
  const users = await prisma.user.findMany();
  console.log("USERS:", users.map(u => ({ id: u.id, email: u.email, role: u.role })));
}
main().catch(console.error);
