import supabase from "../../lib/supabaseClient";


export default async function handler(req, res) {


    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });

    }



    const {
        shipmentId,
        eventType
    } = req.body;




    if (!shipmentId || !eventType) {

        return res.status(400).json({
            error: "Missing shipmentId or eventType"
        });

    }







    // GET SHIPMENT INFORMATION

    const { data: shipment, error: shipmentError } =
        await supabase

            .from("shipsments")

            .select(`
                *,
                shipper:shipper_id (
                    id,
                    full_name
                ),
                driver:driver_id (
                    id,
                    full_name
                )
            `)

            .eq("id", shipmentId)

            .single();





    if (shipmentError) {

        return res.status(400).json({
            error: shipmentError.message
        });

    }







    let title = "";

    let message = "";






    switch (eventType) {


        case "MATCHED":

            title = "Driver Found 🚚";

            message =
                `${shipment.driver?.full_name || "A driver"} accepted your shipment.`;

            break;





        case "DEPARTED":

            title = "Shipment Started 🚛";

            message =
                "Your shipment is now on the way.";

            break;





        case "ARRIVED":

            title = "Driver Arrived 📍";

            message =
                "Your shipment arrived at destination.";

            break;





        case "COMPLETED":

            title = "Delivery Completed ✅";

            message =
                "Your shipment has been delivered successfully.";

            break;





        default:

            title = "Shipment Update";

            message =
                "Your shipment status has changed.";

    }









    // SAVE NOTIFICATION

    const { error: notificationError } =

        await supabase

            .from("notifications")

            .insert([

                {

                    user_id: shipment.shipper_id,

                    shipment_id: shipmentId,

                    title,

                    message,

                    type: eventType

                }

            ]);








    if (notificationError) {


        return res.status(400).json({

            error: notificationError.message

        });


    }








    return res.status(200).json({

        success: true,

        message: "Notification created"

    });



}