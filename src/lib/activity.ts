import { db } from "./db";

export async function logActivity(
  collectionId: string,
  type: string,
  detail = "",
  clientEmail = ""
) {
  await db.activity.create({ data: { collectionId, type, detail, clientEmail } });
}
