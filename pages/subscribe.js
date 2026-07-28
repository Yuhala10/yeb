import { useState } from 'react';
import supabase from '../lib/supabaseClient';

export default function SubscribePage({ userId }) {
    const [txid, setTxid] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmitTxid(e) {
        e.preventDefault();

        if (!txid.trim()) return;

        setLoading(true);

        const { error } = await supabase
            .from('subscriptions')
            .insert([
                {
                    user_id: userId,
                    momo_txid: txid.trim(),
                    amount: 5000,
                    status: 'PENDING',
                },
            ]);

        setLoading(false);

        if (error) {
            console.error(error);
            alert('Error submitting TxID. Please try again.');
            return;
        }

        setSubmitted(true);
        setTxid('');
    }

    return (
        <div className="min-h-screen bg-tayebBg text-tayebDark flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-md max-w-sm w-full space-y-5">

                <div className="text-center space-y-1">
                    <div className="w-12 h-12 bg-tayebYellow rounded-2xl flex items-center justify-center font-black text-2xl mx-auto">
                        T
                    </div>

                    <h2 className="text-xl font-extrabold text-tayebDark">
                        Access Expired
                    </h2>

                    <p className="text-xs text-gray-500">
                        Subscribe for 30-day unlimited access to Tayeb
                    </p>
                </div>

                <div className="bg-amber-50 border border-tayebYellow p-4 rounded-2xl space-y-2 text-xs">
                    <p className="font-bold text-gray-900">
                        How to activate:
                    </p>

                    <ol className="list-decimal pl-4 space-y-1 text-gray-700">
                        <li>Transfer <strong>5,000 FCFA</strong> via MTN MoMo / Orange Money.</li>
                        <li>Send payment to <strong className="text-tayebOrange">681 73 15 12</strong>.</li>
                        <li>Account Name: <strong>Darren Yuhala</strong>.</li>
                        <li>Copy the <strong>TxID</strong> from your payment SMS.</li>
                    </ol>
                </div>

                {!submitted ? (
                    <form onSubmit={handleSubmitTxid} className="space-y-3">

                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">
                                Transaction ID (TxID)
                            </label>

                            <input
                                type="text"
                                placeholder="e.g. 28491028391"
                                value={txid}
                                onChange={(e) => setTxid(e.target.value)}
                                required
                                className="w-full bg-gray-50 border border-gray-200 text-sm font-mono font-bold rounded-xl px-3 py-3 focus:outline-none focus:border-tayebOrange"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-tayebOrange hover:bg-orange-600 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow transition-all"
                        >
                            {loading ? 'Submitting...' : 'SUBMIT TXID FOR APPROVAL'}
                        </button>

                    </form>
                ) : (
                    <div className="bg-green-50 border border-green-200 p-4 rounded-2xl text-center space-y-1">
                        <p className="font-extrabold text-green-800 text-sm">
                            TxID Submitted!
                        </p>

                        <p className="text-xs text-green-600">
                            Your account will unlock automatically as soon as payment is verified by the admin.
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
}