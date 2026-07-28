import { useState } from 'react';
import supabase from '../lib/supabaseClient';

export default function FeedbackPage({ userId = null }) {
    const [type, setType] = useState('SUGGESTION');
    const [message, setMessage] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();

        if (!message.trim()) {
            alert('Please enter your feedback.');
            return;
        }

        setLoading(true);

        const { error } = await supabase
            .from('feedback')
            .insert([
                {
                    user_id: userId,
                    feedback_type: type,
                    message: message.trim(),
                    contact_phone: phone.trim() || null,
                    status: 'UNREAD',
                },
            ]);

        setLoading(false);

        if (error) {
            console.error(error);
            alert(error.message);
            return;
        }

        setSent(true);
        setMessage('');
        setPhone('');
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4 antialiased">

            <div className="bg-white p-6 rounded-[2.2rem] border border-slate-100 shadow-xl max-w-sm w-full space-y-4">

                <h1 className="text-lg font-black text-slate-900">
                    Tayeb Feedback & Support
                </h1>

                {sent ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center">
                        <p className="font-bold text-emerald-800">
                            Thank you!
                        </p>

                        <p className="text-xs text-emerald-700 mt-2">
                            Your message has been sent to the Tayeb admin.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">

                        <div className="flex space-x-2">

                            {['SUGGESTION', 'PROBLEM', 'DISPUTE'].map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${type === t
                                            ? 'bg-slate-900 text-amber-400 border-slate-900'
                                            : 'bg-slate-50 border-slate-200 text-slate-600'
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}

                        </div>

                        <textarea
                            rows={5}
                            required
                            value={message}
                            placeholder="Describe your suggestion, issue or dispute..."
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-500"
                        />

                        <input
                            type="text"
                            value={phone}
                            placeholder="Phone Number (Optional)"
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-500"
                        />

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-2xl btn-bounce"
                        >
                            {loading ? 'SENDING...' : 'SUBMIT FEEDBACK'}
                        </button>

                    </form>
                )}

            </div>

        </div>
    );
}