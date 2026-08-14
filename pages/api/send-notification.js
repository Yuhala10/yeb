import supabase from "../../lib/supabaseClient";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed",
        });
    }

    const {
        shipmentId,
        eventType,
        targetUserId,
        title,
        message,
        type,
    } = req.body;

    if (!shipmentId || !eventType) {
        return res.status(400).json({
            error: "Missing shipmentId or eventType",
        });
    }

    // =========================================================
    // GET SHIPMENT
    // =========================================================

    const { data: shipment, error: shipmentError } =
        await supabase
            .from("shipments")
            .select(`
                *,
                shipper:shipper_id (
                    id,
                    full_name,
                    phone_number
                ),
                driver:driver_id (
                    id,
                    full_name,
                    phone_number
                )
            `)
            .eq("id", shipmentId)
            .single();

    if (shipmentError) {
        return res.status(400).json({
            error: shipmentError.message,
        });
    }

    // =========================================================
    // TARGET USER
    // =========================================================

    let userId = targetUserId || null;

    // =========================================================
    // SHIPMENT STATUS NOTIFICATIONS
    // =========================================================

    let notificationTitle = title || "";
    let notificationMessage = message || "";
    let notificationType = type || eventType;

    switch (eventType) {
        case "MATCHED":
            userId = userId || shipment.shipper_id;

            notificationTitle =
                notificationTitle || "Driver Found 🚚";

            notificationMessage =
                notificationMessage ||
                `${shipment.driver?.full_name || "A driver"} has been selected for your shipment.`;

            break;

        case "DEPARTED":
            userId = userId || shipment.shipper_id;

            notificationTitle =
                notificationTitle || "Shipment Started 🚛";

            notificationMessage =
                notificationMessage ||
                "Your shipment is now on the way.";

            break;

        case "ARRIVED":
            userId = userId || shipment.shipper_id;

            notificationTitle =
                notificationTitle || "Driver Arrived 📍";

            notificationMessage =
                notificationMessage ||
                "Your shipment has arrived at the destination.";

            break;

        case "COMPLETED":
            userId = userId || shipment.shipper_id;

            notificationTitle =
                notificationTitle || "Delivery Completed ✅";

            notificationMessage =
                notificationMessage ||
                "Your shipment has been delivered successfully.";

            break;

        case "NEW_SHIPMENT":
            userId = targetUserId;

            notificationTitle =
                notificationTitle || "New Cargo Available 📦";

            notificationMessage =
                notificationMessage ||
                `A new shipment is available from ${shipment.origin} to ${shipment.destination}.`;

            break;

        case "BID_RECEIVED":
            userId = targetUserId || shipment.shipper_id;

            notificationTitle =
                notificationTitle || "New Driver Offer 🚚";

            notificationMessage =
                notificationMessage ||
                "A driver has sent you a price for your shipment.";

            break;

        case "COUNTER_OFFER":
            userId = targetUserId;

            notificationTitle =
                notificationTitle || "New Price Offer 💰";

            notificationMessage =
                notificationMessage ||
                "The other person has suggested another price.";

            break;

        case "DRIVER_SELECTED":
            userId = targetUserId || shipment.driver_id;

            notificationTitle =
                notificationTitle || "You Were Selected 🎉";

            notificationMessage =
                notificationMessage ||
                "The sender accepted your price. You can now arrange pickup.";

            break;

        case "DRIVER_NOT_SELECTED":
            userId = targetUserId;

            notificationTitle =
                notificationTitle || "Shipment Already Assigned";

            notificationMessage =
                notificationMessage ||
                "Another driver was selected for this shipment.";

            break;

        default:
            userId = targetUserId || shipment.shipper_id;

            notificationTitle =
                notificationTitle || "Shipment Update";

            notificationMessage =
                notificationMessage ||
                "Your shipment status has changed.";
    }

    // =========================================================
    // MAKE SURE WE HAVE A USER
    // =========================================================

    if (!userId) {
        return res.status(400).json({
            error: "No notification recipient found.",
        });
    }

    // =========================================================
    // SAVE NOTIFICATION
    // =========================================================

    const { error: notificationError } =
        await supabase
            .from("notifications")
            .insert([
                {
                    user_id: userId,
                    shipment_id: shipmentId,
                    title: notificationTitle,
                    message: notificationMessage,
                    type: notificationType,
                    read: false,
                },
            ]);

    if (notificationError) {
        return res.status(400).json({
            error: notificationError.message,
        });
    }

    return res.status(200).json({
        success: true,
        message: "Notification created",
    });
}