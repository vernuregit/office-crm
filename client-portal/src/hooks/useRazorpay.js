import { loadRazorpayScript } from "../utils/loadRazorpay";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";

const useRazorpay = () => {
  const { user, userData } = useAuthStore();

  const initiatePayment = async ({ invoiceId, amount, description, onSuccess }) => {
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      alert("Failed to load Razorpay. Check your internet connection.");
      return;
    }

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: amount * 100,           // Razorpay expects paise
      currency: "INR",
      name: "CA Firm",
      description: description || "Invoice Payment",
      handler: async (response) => {
        // Mark invoice as paid in Firestore
        await updateDoc(doc(db, "invoices", invoiceId), {
          status: "paid",
          paymentId: response.razorpay_payment_id,
          paidAt: new Date(),
        });
        onSuccess && onSuccess(response);
      },
      prefill: {
        name: userData?.name || "",
        email: userData?.email || "",
        contact: userData?.phone || "",
      },
      theme: { color: "#1E3A5F" },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  return { initiatePayment };
};

export default useRazorpay;
