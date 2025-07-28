import { ADMIN } from '$env/static/private';
import admin from 'firebase-admin'
import FirebaseAdmin from 'firebase-admin';
const firebaseAuth = FirebaseAdmin.auth;
import type { Auth, DecodedIdToken, UserRecord } from 'firebase-admin/auth';
import { type Firestore, getFirestore as getFirebaseFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
export let firebaseAdmin = getFirebaseAdmin();

function getFirebaseAdmin() {
    let app: admin.app.App | undefined = undefined;
    let auth: Auth | undefined = undefined;
    let firestore: Firestore | undefined = undefined;
    let bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]> | undefined =
    undefined;

    const getFirebaseApp = (): admin.app.App => {
        if(app == undefined) { // When using hot reload in dev mode, initializing app may be recalled when it doesn't need to be.
            if(admin.apps == null) {
                app = admin.initializeApp({
                    credential: admin.credential.cert(
                        JSON.parse(ADMIN) as admin.ServiceAccount,
                    ),
                }, "Server");
            } else if(admin.apps.length == 0) {
                app = admin.initializeApp({
                    credential: admin.credential.cert(
                        JSON.parse(ADMIN) as admin.ServiceAccount,
                    ),
                }, "Server");
            } else {
                var found = false;
                for(var i = 0; i < admin.apps.length; i++) {
                    if(admin.apps[i] != null && (admin.apps[i] as admin.app.App).name == "Server") {
                        app = admin.apps[i] as admin.app.App;
                        found = true;
                    }
                }
                if(found == false) {
                    throw new Error("Firebase Admin is being goofy again");
                }
            }
        }
    
        return app as admin.app.App;
    }

    const getAuth = (): Auth => {
        if(auth == undefined) {
            auth = firebaseAuth(getFirebaseApp());
        }

        return auth;
    }

    const getFirestore = (): Firestore => {
        if(firestore == undefined) {
            firestore = getFirebaseFirestore(getFirebaseApp());
        }

        return firestore;
    }

    const getBucket = (): ReturnType<ReturnType<typeof getStorage>["bucket"]> => {
        if (bucket == undefined) {
            bucket = getStorage(getFirebaseApp()).bucket();
        }

        return bucket;
    };

    return {
        getApp: getFirebaseApp,
        getAuth: getAuth,
        getFirestore: getFirestore,
        getBucket: getBucket,
    }
}

export async function getUser( session: string ): Promise<UserRecord | undefined> {
    try {
      const start = new Date();
      
      console.log("DECODING", new Date().valueOf() - start.valueOf());
      
      const decodedToken = await firebaseAdmin.getAuth().verifySessionCookie(session, true);
  
      console.log("DONE DECODING", new Date().valueOf() - start.valueOf());
  
      const user = await firebaseAdmin.getAuth().getUser(decodedToken.uid);
      
      console.log("FETCHED AUTH", new Date().valueOf() - start.valueOf());
  
      return user;
    } catch (e) {
      console.log(e);
      return undefined;
    }
  }

export function verifySession(session: string | undefined, secure = false) {
    return new Promise((resolve) => {
        if (session == undefined) {
            resolve(false);
            return;
        }

        firebaseAdmin
            .getAuth()
            .verifySessionCookie(session, secure)
            .then((decodedToken) => {
                resolve(true);
                return;
            })
            .catch((error) => {
                resolve(false);
                return;
            });
    });
}

export function getToken(session: string): Promise<DecodedIdToken | undefined> {
    return new Promise<DecodedIdToken | undefined>((resolve) => {
        firebaseAdmin
            .getAuth()
            .verifySessionCookie(session, true)
            .then((decodedToken) => {
                resolve(decodedToken);
                return;
            })
            .catch((error) => {
                resolve(undefined);
                return;
            });
    });
}