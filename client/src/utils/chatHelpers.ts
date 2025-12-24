import { getOrCreateChatRoom } from "@/services/chatService";
import { initializeFirebaseAuth, auth } from "@/lib/firebase";


const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/**
 * Start a chat with a retailer
 */
export async function startChatWithRetailer(
  retailerId: string,
  currentUser: { id: string; username: string; role: string },
  navigate: (path: string) => void
) {
  try {
    console.log("Starting chat - Step 1: Initializing Firebase auth...");
    
    // Ensure Firebase auth is initialized first
    await initializeFirebaseAuth();
    
    // Check auth state
    console.log("Firebase auth state:", {
      currentUser: auth.currentUser?.uid,
      isAuthenticated: !!auth.currentUser,
    });

    if (!auth.currentUser) {
      throw new Error("Firebase authentication failed - please enable Anonymous Authentication in Firebase Console");
    }
    
    console.log("Step 2: Getting retailer info...");
    // Get retailer's user_id
    const res = await fetch(`${API_BASE_URL}/retailer/${retailerId}/user`, {
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to get retailer information");
    }

    const retailerUserId = data.data.userId;
    const retailerName = data.data.businessName;

    console.log("Step 3: Creating chat room...", {
      userId1: currentUser.id,
      userId2: retailerUserId,
    });

    // Create or get chat room
    const roomId = await getOrCreateChatRoom(
      currentUser.id,
      retailerUserId,
      currentUser.username,
      retailerName,
      currentUser.role,
      "retailer",
      "buyer-seller"
    );

    console.log("Chat room created:", roomId);

    // Navigate to messages page with roomId
    navigate(`/messages?roomId=${roomId}`);
    
    return roomId;
  } catch (error: any) {
    console.error("Failed to start chat:", error);
    
    // Provide helpful error message
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      throw new Error(
        "Permission denied. Please ensure:\n" +
        "1. Anonymous Authentication is enabled in Firebase Console\n" +
        "2. Firestore security rules allow authenticated users\n" +
        "3. Check browser console for more details"
      );
    }
    
    throw error;
  }
}
