import { verifySession } from "$lib/Firebase/firebase.server";
import { error, json, type RequestHandler } from "@sveltejs/kit";
import { getAuth as adminAuth } from "firebase-admin/auth";

export const POST = (async ({ request, cookies }) => {
  //not really used at this point, refreshing isn't really that clean with firebase
  const authorized = await verifySession(cookies.get("__session"));

  if (authorized) {
    return json({ Authorization: "Success" });
  } else {
    throw error(401, "UNAUTHORIZED REQUEST");
  }
}) satisfies RequestHandler;
