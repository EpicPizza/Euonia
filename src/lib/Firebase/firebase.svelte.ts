import { invalidateAll } from "$app/navigation";
import { initializeApp, type FirebaseApp } from "firebase/app";
import { type Auth, getAuth as getFirebaseAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithEmailAndPassword, type User, signInWithRedirect, signInWithPopup, createUserWithEmailAndPassword, updateCurrentUser, updateProfile, sendEmailVerification, updateEmail, reauthenticateWithCredential, EmailAuthProvider, updatePassword, validatePassword, sendPasswordResetEmail, signInAnonymously } from "firebase/auth";
import { getFirestore as getFirebaseFirestore, type Firestore, type Unsubscribe, doc, getDoc, onSnapshot } from "firebase/firestore";
import { browser } from "$app/environment";
import type { UserInfo as AdminUserInfo } from "firebase-admin/auth";
import type { UserInfo as ClientUserInfo } from "firebase/auth";
import { user as userStore } from '$lib/stores/user';

interface Preload {
  photoURL: string | undefined;
  email: string | undefined;
  displayName: string | undefined;
  providerData: (ClientUserInfo | AdminUserInfo)[];
  uid: string;
  cookies: number,
  preload: boolean;
}

interface FirestoreUser {
  verified: boolean;
}

type Main = FirestoreUser & Preload;

export type Client = ReturnType<typeof firebaseClient>;

export function firebaseClient() {
  let user = $state(undefined) as Main | undefined;
  let loaded = $derived(user?.preload == false);

  let app: FirebaseApp | undefined = undefined;
  let auth: Auth | undefined = undefined;
  let provider: GoogleAuthProvider | undefined = undefined;
  let firestore: Firestore | undefined = undefined;
  let unsubscribe: Unsubscribe | undefined = undefined;
  let firestoreEntry: any | undefined = undefined;
  let rawUser: User | undefined = undefined;

  const getApp = (): FirebaseApp => {
    if (!browser) return undefined as any;                    

    if (app == undefined) {
      const firebaseConfig = {
        apiKey: "AIzaSyCvfIWQaG1OrSzRewV1nmu1aAnaKZG1TpQ",
        authDomain: "humanehackathon.firebaseapp.com",
        projectId: "humanehackathon",
        storageBucket: "humanehackathon.firebasestorage.app",
        messagingSenderId: "5363443441",
        appId: "1:5363443441:web:9271866281acbf632d2b50"
      };
      
      app = initializeApp(firebaseConfig);
    }

    return app;
  };

  const getAuth = (): Auth => {
    if (auth == undefined) {
      auth = getFirebaseAuth(getApp());
    }

    return auth;
  };

  const getAuthUser = (): ReturnType<typeof getAuth>["currentUser"] | null => {
    return getAuth().currentUser;
  };

  const getFirestoreEntry = (): any => {
    return firestoreEntry;
  };

  const getProvider = (): GoogleAuthProvider => {
    if (provider == undefined) {
      provider = new GoogleAuthProvider();
    }

    return provider;
  };

  const handleCredential = async (credential: any) => {
    const result = await signInWithCredential(getAuth(), credential);

    console.log(result);
  }

  const getFirestore = (): Firestore => {
    if (firestore == undefined) {
      firestore = getFirebaseFirestore(getApp());
    }

    return firestore;
  };

  const serverInit = (preload: Main | undefined) => {
    if (preload == undefined) {
      user = undefined;
    } else {
      user = preload;
    }
  };

  const clientInit = (loading: (set: boolean) => void) => {
    onAuthStateChanged(getAuth(), async (currentUser) => {
      userStore.set(currentUser);
      console.log("CURRENT", currentUser == null);
      console.log("USER", user == undefined);


      if (
        currentUser == null &&
        user != undefined &&
        user.preload == false
      ) {
        user = undefined;
        rawUser = undefined;

        invalidateAll();

        return;
      } else if (
        currentUser == null &&
        user != undefined &&
        user.preload == true
      ) {
        await fetch("/session/logout", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
        });

        user = undefined;
        rawUser = undefined;

        invalidateAll();
      }

      if (currentUser != null && user == undefined) {
        const token = await currentUser.getIdToken();

        const result = await fetch("/session/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (result.status == 401) {
          signOut();
          return;
        }

        rawUser = currentUser;

        const firestoreUser = await getFirestoreUser(currentUser.uid);

        if (firestoreUser == undefined) {
          user = {
            ...{
              displayName: currentUser.displayName == null ? undefined : currentUser.displayName,
              email: currentUser.email == null ? undefined : currentUser.email,
              uid: currentUser.uid,
              photoURL: currentUser.photoURL == null ? undefined : currentUser.photoURL,
              providerData: currentUser.providerData,
              verified: false,
              cookies: -1,
              preload: false
            }
          };
        } else {
          user = {
            ...{
              displayName: currentUser.displayName == null ? undefined : currentUser.displayName,
              email: currentUser.email == null ? undefined : currentUser.email,
              uid: currentUser.uid,
              photoURL: currentUser.photoURL == null ? undefined : currentUser.photoURL,
              providerData: currentUser.providerData,
              verified: false,
              cookies: -1,
              preload: false
            },
            ...firestoreUser,
          };
        }

        invalidateAll();

        loading(false);
      } else if (currentUser != null) {
        console.log("ITS HAPPENING???");

        rawUser = currentUser;

        const firestoreUser = await getFirestoreUser(currentUser.uid);

        if (firestoreUser == undefined) {
          user = {
            ...{
              displayName: currentUser.displayName == null ? undefined : currentUser.displayName,
              email: currentUser.email == null ? undefined : currentUser.email,
              uid: currentUser.uid,
              photoURL: currentUser.photoURL == null ? undefined : currentUser.photoURL,
              verified: false,
              providerData: currentUser.providerData,
              cookies: -1,
              preload: false
            }
          };
        } else {
          user = {
            ...{
              displayName: currentUser.displayName == null ? undefined : currentUser.displayName,
              email: currentUser.email == null ? undefined : currentUser.email,
              uid: currentUser.uid,
              photoURL: currentUser.photoURL == null ? undefined : currentUser.photoURL,
              providerData: currentUser.providerData,
              cookies: -1,
              preload: false
            },
            ...firestoreUser,
          };
        }

        loading(false);
      }
    });
  };

  const sendPasswordReset = async (email: string) => {
    if(email == "") return "Email must be filled.";

    try {
      await sendPasswordResetEmail(getAuth(), email);
    } catch(e: any) {
      if(e.code == "auth/invalid-email") {
        return "Invalid email."
      }

      return e.message as string;
    }

    return true;
  }

  const signInWithPassword = async(email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(getAuth(), email, password);

      return true;
    } catch(e: any) {
      if(e.code == "auth/invalid-credential") {
        return "Incorrect password."
      } else if(e.code == "auth/invalid-email") {
        return "Invalid email."
      } else if(e.code == "auth/missing-password") {
        return "All fields must be filled.";
      }

      return e.message as string;
    }
  }

  const sendEmail = async () => {
    try {
      if(rawUser) await sendEmailVerification(rawUser, {
        url: "http://localhost:5173/account/verified?uid=" + rawUser.uid
      });

      return true;
    } catch(e: any) {
      return e.message as string; 
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if(currentPassword == "" && newPassword == "") return "All fields must be filled.";
    if (!(await validatePassword(getAuth(), newPassword)).isValid) return "Invalid password.";
    if(rawUser == undefined) return "Not signed in.";

    console.log("Password validated.");

    let reCredential;
    let reAuth;

    try {
      reCredential = EmailAuthProvider.credential(rawUser.email ?? "" , currentPassword)
      reAuth = (await signInWithCredential(getAuth(), reCredential)).user;

      await reauthenticateWithCredential(reAuth, reCredential);
    } catch(e: any) {
      if(e.code == "auth/invalid-credential") {
        return "Incorrect password."
      } else if(e.code == "auth/invalid-email") {
        return "Invalid email."
      } else if(e.code == "auth/missing-password") {
        return "All fields must be filled.";
      } else if(e.code == "auth/too-many-requests") {
        return "Too many requests.";
      }

      return e.message as string;
    }

    console.log("Account reauthenticated.");

    try {
      await updatePassword(reAuth, newPassword);
    } catch(e: any) {
      if(e.code == "auth/email-already-in-use") {
        return "Account already created with this email.";
      } else if(e.code == "auth/password-does-not-meet-requirements") {
        return "Invalid password.";
      } else if(e.code == "auth/invalid-email") {
        return "Invalid email."
      }

      return e.message as string;
    }

    const result = await fetch("/session/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${await reAuth.getIdToken()}`,
      },
    });

    if (result.status == 401) {
      signOut();

      return "Failed to reauthenticate.";
    }

    return true;
  }

  const createUser = async (email: string, password: string, name: string) => {
    if(email == "" || password == "" || name == "") {
      return "All fields must be filled.";
    }

    const auth = getAuth();

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(credential.user, {
        displayName: name,
      });

      if(rawUser != undefined && user) {
        rawUser.reload();
        user.displayName = name;
      }
    } catch(e: any) {
      if(e.code == "auth/email-already-in-use") {
        return "Account already created with this email.";
      } else if(e.code == "auth/password-does-not-meet-requirements") {
        return "Invalid password.";
      } else if(e.code == "auth/invalid-email") {
        return "Invalid email."
      }

      return e.message as string;
    }

    return true;
  }

  const getFirestoreUser = async ( id: string ): Promise<FirestoreUser | undefined> => {
    const db = getFirestore();

    const userRef = doc(db, "users", id);
    let userData;
    try {
      userData = (await getDoc(userRef)).data();
    } catch (e) {
      console.log(e);
      userData == undefined;
      return;
    
    }

    if (unsubscribe != undefined) {
      unsubscribe();
    }

    unsubscribe = onSnapshot(userRef, async (snapshot) => {
      if (snapshot.data() != undefined) {
        if (user != undefined) {
          //prevents updates when user is signed out alr or website is still loading (preload exists)
          firestoreEntry = snapshot.data();

          user = {
            ...user,
            ...(firestoreEntry),
          };
        }
      }
    });

    return userData
      ? ({
          ...userData,
        } as FirestoreUser)
      : undefined;
  };

  const signIn = async () => {
    getAuth().signOut();

    const url = new URL(window.location.href);

    url.searchParams.set("login", "in-progress");

    window.history.replaceState({}, "", url.toString());

    signInWithPopup(getAuth(), getProvider()).catch((error) => {
      console.log(error);
    }); 
  };

  const signInAnonymouslyAndListen = async () => {
    try {
      await signInAnonymously(getAuth());
    } catch (e) {
      console.error(e);
    }
  };

  const signOut = async () => {
    await fetch("/session/logout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    });

    getAuth().signOut();
  };

  const reset = async () => {
    await fetch("/session/reset", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    });

    getAuth().signOut();
  };

  const getUser = () => {
    return rawUser;
  }

  return {
    get user() { return user; },
    set user(updatedUser) { user = updatedUser; },
    clientInit: clientInit,
    getUser: getUser,
    signIn: signIn,
    signInAnonymouslyAndListen,
    signOut: signOut,
    reset: reset,
    serverInit: serverInit,
    getFirestore: getFirestore,
    getApp: getApp,
    sendEmail: sendEmail,
    debug: {
      getUser: getAuthUser,
      getEntry: getFirestoreEntry,
    },
    handleCredential: handleCredential,
    createUser: createUser,
    signInWithPassword: signInWithPassword,
    changePassword: changePassword,
    sendPasswordReset: sendPasswordReset,
    get loaded() { return loaded },
  };
}
