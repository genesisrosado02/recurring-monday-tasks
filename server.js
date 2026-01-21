const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

// 1. Basic Health Check
app.get('/', (req, res) => res.status(200).send("Server is live."));

// 2. Helper to get Tag ID for the Client (ProtectiCloud, etc.)
async function getTagId(tagName) {
    const query = `mutation { create_or_get_tag (tag_name: "${tagName}") { id } }`;
    const res = await axios.post('https://api.monday.com/v2', { query }, {
        headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2024-01' }
    });
    return res.data.data.create_or_get_tag.id;
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// --- 3. REMOTE OPTION ENDPOINTS (For Monday Dev Center) ---
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));

app.all('/get-day-of-month-options', (req, res) => {
    const options = Array.from({ length: 31 }, (_, i) => {
        const n = i + 1;
        const s = ["th", "st", "nd", "rd"], v = n % 100;
        const suffix = s[(v - 20) % 10] || s[v] || s[0];
        return { title: `${n}${suffix}`, value: `${n}` };
    });
    res.json(options);
});

// --- 4. AUTOMATION 1: Nth DAY OF CURRENT MONTH ---
app.post('/calculate-task-with-tag', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || payload.inputFields;
        const { boardId, groupId, tagsColumn, tag_names, name } = inputFields;

        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;
        
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);
        const dueDate = d.toISOString().split('T')[0];

        const clientTagId = await getTagId(tag_names);

        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": dueDate },
            [tagsColumn]: { "tag_ids": [parseInt(clientTagId)] },
            [process.env.MONTH_STATUS_COLUMN_ID]: { "label": monthNames[d.getMonth()] } 
        };

        const query = `mutation { create_item (board_id: ${parseInt(boardId)}, group_id: "${groupId}", item_name: "${name}", column_values: ${JSON.stringify(JSON.stringify(columnValues))}) { id } }`;
        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } 
        });

        res.status(200).send({});
    } catch (err) { console.error(err); res.status(200).send({}); }
});

// --- 5. AUTOMATION 2: X-DAY OF NEXT MONTH ---
app.post('/calculate-next-month-task', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || payload.inputFields;
        const { boardId, groupId, tagsColumn, tag_names, name, day_of_month } = inputFields;

        const now = new Date();
        // JavaScript Date constructor handles year rollover automatically
        const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const targetDay = parseInt(day_of_month?.value || day_of_month || 7);
        nextMonthDate.setDate(targetDay);
        const dueDate = nextMonthDate.toISOString().split('T')[0];

        const clientTagId = await getTagId(tag_names);

        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": dueDate },
            [tagsColumn]: { "tag_ids": [parseInt(clientTagId)] },
            [process.env.MONTH_STATUS_COLUMN_ID]: { "label": monthNames[nextMonthDate.getMonth()] }
        };

        const query = `mutation { create_item (board_id: ${parseInt(boardId)}, group_id: "${groupId}", item_name: "${name}", column_values: ${JSON.stringify(JSON.stringify(columnValues))}) { id } }`;
        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } 
        });

        res.status(200).send({});
    } catch (err) { console.error(err); res.status(200).send({}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
