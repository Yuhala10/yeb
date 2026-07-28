import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://hzsobsyxarsxlbxflyaw.supabase.co',
    'sb_publishable_z6z2C0wZ5BkmBFKeB4OMwA_W0pusm8_'
);

export default supabase;