import supabase from "../../lib/supabaseClient";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method Not Allowed",
        });
    }

    const { shipmentId, eventType } = req.body;

    try {
        const { data: shipment, error } = await supabase
            .from("shipments")
            .select("*")
            .eq("id", shipmentId)
            .single();

        if (error || !shipment) {
            return res.status(404).json({
                success: false,
                message: "Shipment not found",
            });
        }

        let notificationMessage = "";

        switch (eventType) {
            case "MATCHED":
                notificationMessage = `A driver has accepted your shipment from ${shipment.origin} to ${shipment.destination}.`;
                break;

            case "DEPARTED":
                notificationMessage = `Your shipment has departed for ${shipment.destination}.`;
                break;

            case "ARRIVED":
                notificationMessage = `Your shipment has arrived at ${shipment.destination}. Please contact the driver for collection.`;
                break;

            case "COMPLETED":
                notificationMessage = "Your shipment has been completed successfully. Thank you for using Tayeb.";
                break;

            default:
                notificationMessage = `Shipment status changed to ${eventType}.`;
        }

        // Notification Engine (currently simulated)
        console.log("==================================================");
        console.log("TAYEB NOTIFICATION ENGINE");
        console.log("Recipient:", shipment.receiver_phone);
        console.log("Event:", eventType);
        console.log("Message:", notificationMessage);
        console.log("==================================================");

        return res.status(200).json({
            success: true,
            event: eventType,
            recipient: shipment.receiver_phone,
            notification: notificationMessage,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}