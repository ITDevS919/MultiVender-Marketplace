import {
  collection,
  doc,
  addDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { initializeFirebaseAuth } from "@/lib/firebase";

// Ensure Firebase auth is initialized before operations
async function ensureAuth(): Promise<void> {
  // If already authenticated, return immediately
  if (auth.currentUser) {
    return;
  }

  // Wait for auth initialization
  await initializeFirebaseAuth();

  // Double-check that we have a user
  if (!auth.currentUser) {
    throw new Error("Firebase authentication failed - no user after initialization");
  }
}

export interface Message {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: "customer" | "retailer" | "admin";
    receiverId: string;
    receiverName: string;
    text: string;
    timestamp: Date;
    read: boolean;
    type: "buyer-seller" | "support";
  }
  
  export interface ChatRoom {
    id: string;
    participants: string[]; // User IDs (includes both app user IDs and Firebase auth UIDs)
    appUserIds?: string[]; // App user IDs only (for querying and participant matching)
    participantNames: { [userId: string]: string };
    participantRoles: { [userId: string]: string };
    lastMessage?: string;
    lastMessageTime?: Date;
    unreadCount: { [userId: string]: number };
    type: "buyer-seller" | "support";
    createdAt: Date;
  }
  
  /**
   * Get or create a chat room between two users
   */
  export async function getOrCreateChatRoom(
    userId1: string,
    userId2: string,
    userName1: string,
    userName2: string,
    role1: string,
    role2: string,
    type: "buyer-seller" | "support" = "buyer-seller"
  ): Promise<string> {
    await ensureAuth();
  
    // Verify we have Firebase auth user
    if (!auth.currentUser) {
      throw new Error("Firebase authentication required. Please ensure Anonymous Authentication is enabled.");
    }

    const firebaseAuthUid = auth.currentUser.uid;
    console.log("Creating chat room with Firebase UID:", firebaseAuthUid);

    // Create a consistent room ID (sorted user IDs)
    const participants = [userId1, userId2].sort();
    const roomId = participants.join("_");

    const roomRef = doc(db, "chatRooms", roomId);
    
    // Check if room exists
    let roomSnap;
    try {
      roomSnap = await getDoc(roomRef);
    } catch (error: any) {
      console.error("Failed to check if room exists:", error);
      throw new Error(`Failed to access Firestore: ${error.message}`);
    }

    if (!roomSnap.exists()) {
      console.log("Creating new chat room:", roomId);
      
      // Create new room
      try {
        await setDoc(roomRef, {
          id: roomId,
          participants: [...participants, firebaseAuthUid], // Include both app user IDs and Firebase auth UID
          participantNames: {
            [userId1]: userName1,
            [userId2]: userName2,
          },
          participantRoles: {
            [userId1]: role1,
            [userId2]: role2,
          },
          unreadCount: {
            [userId1]: 0,
            [userId2]: 0,
          },
          type,
          createdAt: serverTimestamp(),
          lastMessageTime: serverTimestamp(),

          // Store app user IDs separately for querying
          appUserIds: participants,
          // Store Firebase auth UIDs for security
          firebaseAuthIds: [firebaseAuthUid],
        });
        console.log("Chat room created successfully:", roomId);
      } catch (error: any) {
        console.error("Failed to create chat room:", error);
        console.error("Error details:", {
          code: error.code,
          message: error.message,
          firebaseAuthUid,
          roomId,
        });
        throw error;
      }
    } else {
      console.log("Chat room already exists:", roomId);
      
      // Update room to include current user's Firebase auth UID if not present
      const roomData = roomSnap.data();
      const currentParticipants = roomData?.participants || [];
      const currentFirebaseAuthIds = roomData?.firebaseAuthIds || [];
      
      if (!currentParticipants.includes(firebaseAuthUid)) {
        try {
          await updateDoc(roomRef, {
            participants: [...currentParticipants, firebaseAuthUid],
            firebaseAuthIds: [...currentFirebaseAuthIds, firebaseAuthUid],
          });
          console.log("Updated room with current user's Firebase auth UID");
        } catch (error: any) {
          console.error("Failed to update room with Firebase auth UID:", error);
          // Don't throw - room exists and can still be used
        }
      }
    }

    return roomId;
  }
  
  /**
   * Send a message
   */
  export async function sendMessage(
    roomId: string,
    senderId: string,
    senderName: string,
    senderRole: "customer" | "retailer" | "admin",
    receiverId: string,
    receiverName: string,
    text: string,
    type: "buyer-seller" | "support" = "buyer-seller"
  ): Promise<void> {
    await ensureAuth();
  
    const messagesRef = collection(db, "chatRooms", roomId, "messages");
  
    await addDoc(messagesRef, {
      senderId,
      senderName,
      senderRole,
      receiverId,
      receiverName,
      text,
      timestamp: serverTimestamp(),
      read: false,
      type,
    });
  
    // Update room's last message
    const roomRef = doc(db, "chatRooms", roomId);
    const roomSnap = await getDoc(roomRef);
    const roomData = roomSnap.data();
    const currentUnread = roomData?.unreadCount?.[receiverId] || 0;
    
    await updateDoc(roomRef, {
      lastMessage: text,
      lastMessageTime: serverTimestamp(),
      unreadCount: {
        ...roomData?.unreadCount,
        [receiverId]: currentUnread + 1,
      },
    });
  }
  
  /**
   * Subscribe to messages in a room
   */
  export function subscribeToMessages(
    roomId: string,
    callback: (messages: Message[]) => void
  ): () => void {
    ensureAuth(); // Fire and forget - auth will be ready by the time query runs
  
    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
  
    return onSnapshot(q, 
      (snapshot) => {
        const messages: Message[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            senderId: data.senderId,
            senderName: data.senderName,
            senderRole: data.senderRole,
            receiverId: data.receiverId,
            receiverName: data.receiverName,
            text: data.text,
            timestamp: data.timestamp?.toDate() || new Date(),
            read: data.read,
            type: data.type,
          };
        });
        callback(messages);
      },
      (error) => {
        console.error("Error in message subscription:", error);
        if (error.code === 'permission-denied') {
          console.error("Permission denied - ensure Firebase Anonymous Auth is enabled");
        }
      }
    );
  }
  
  /**
   * Subscribe to user's chat rooms
   */
  export function subscribeToUserChatRooms(
    userId: string,
    callback: (rooms: ChatRoom[]) => void
  ): () => void {
    ensureAuth(); // Fire and forget
  
    console.log("Subscribing to chat rooms for user ID:", userId);
    
    const roomsRef = collection(db, "chatRooms");
    
    // Query by participants (which includes app user IDs)
    // Then filter in memory to only include rooms where userId is in appUserIds
    const q = query(
      roomsRef,
      where("participants", "array-contains", userId),
    );
  
    return onSnapshot(q, 
      (snapshot) => {
        console.log(`Received ${snapshot.docs.length} rooms from Firestore for user ${userId}`);
        
        const rooms: ChatRoom[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const appUserIds = data.appUserIds || [];
            const participants = data.participants || [];
            
            // Filter: only include rooms where userId is in appUserIds
            // (appUserIds contains only app user IDs, not Firebase auth UIDs)
            const isParticipant = appUserIds.length > 0 
              ? appUserIds.includes(userId)
              : participants.includes(userId); // Fallback for old rooms without appUserIds
            
            if (!isParticipant) {
              console.log(`Filtering out room ${doc.id} - user ${userId} not in appUserIds:`, appUserIds);
              return null;
            }
            
            console.log(`Including room ${doc.id} for user ${userId}`);
            
            const room: ChatRoom = {
              id: doc.id,
              participants: data.participants,
              appUserIds: data.appUserIds || data.participants,
              participantNames: data.participantNames,
              participantRoles: data.participantRoles,
              lastMessage: data.lastMessage,
              lastMessageTime: data.lastMessageTime?.toDate(),
              unreadCount: data.unreadCount || {},
              type: data.type,
              createdAt: data.createdAt?.toDate() || new Date(),
            };
            return room;
          })
          .filter((room): room is ChatRoom => room !== null);
        
        console.log(`Returning ${rooms.length} filtered rooms for user ${userId}`);
        callback(rooms);
      },
      (error) => {
        console.error("Error in chat rooms subscription:", error);
        if (error.code === 'permission-denied') {
          console.error("Permission denied - ensure Firebase Anonymous Auth is enabled");
        }
        callback([]);
      }
    );
  }
  
  /**
   * Mark messages as read
   */
  export async function markMessagesAsRead(roomId: string, userId: string): Promise<void> {
    await ensureAuth();
  
    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    const q = query(messagesRef, where("receiverId", "==", userId), where("read", "==", false));
  
    const snapshot = await getDocs(q);
    const batch = snapshot.docs.map((doc) => updateDoc(doc.ref, { read: true }));
  
    await Promise.all(batch);
  
    // Reset unread count
    const roomRef = doc(db, "chatRooms", roomId);
    await updateDoc(roomRef, {
      [`unreadCount.${userId}`]: 0,
    });
  }


