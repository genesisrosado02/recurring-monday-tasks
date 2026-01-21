const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => res.status(200).send("Server is live."));

// Helper to get Tag ID for the Client
async function getTagId(tagName) {
    const query = `mutation { create_or_get_tag (tag_name: "${tagName}") { id } }`;
    const res = await axios.post('https://api.monday.com/v2', { query }, {
        headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2024-01' }
    });
    return res.data.data.create_or_get_tag.id;
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// --- OPTION ENDPOINTS ---
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));

// Dynamic 1st-31st Dropdown Logic
app.all('/get-day-of-month-options', (req, res) => {
    const options = Array.from({ length: 31 }, (_, i) => {
        const n = i + 1;
        const s = ["th", "st", "nd", "rd"], v = n % 100;
        const suffix = s[(v - 20) % 10] || s[v] || s[0];
        return { title: `${n}${suffix}`, value: `${n}` };
    });
    res.json(options);
});

// --- SHARED ITEM CREATION ENGINE ---
async function createMondayItem(boardId, groupId, itemName, dueDate, clientTagName, monthName, tagsColumnId) {
    const clientTagId = await getTagId(clientTagName);
    
    const columnValues = {
        [process.env.DUE_DATE_COLUMN_ID]: { "date": dueDate },
        [tagsColumnId]: { "tag_ids": [parseInt(clientTagId)] },
        [process.env.MONTH_STATUS_COLUMN_ID]: { "label": monthName }
    };

    const query = `mutation { 
        create_item (
            board_id: ${parseInt(boardId)}, 
            group_id: "${groupId}", 
            item_name: "${itemName}", 
            create_labels_if_missing: true,
            column_values: ${JSON.stringify(JSON.stringify(columnValues))}
        ) { id } 
    }`;

    return axios.post('https://api.monday.com/v2', { query }, { 
        headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } 
    });
}

// AUTOMATION 1: Nth Day of Current Month
app.post('/calculate-task-with-tag', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inboundFieldValues || payload.inputFields;
        
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(fields.day_of_week?.value || fields.day_of_week)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(fields.nth_occurence?.value || fields.nth_occurence) - 1) * 7);
        
        await createMondayItem(fields.boardId, fields.groupId, fields.name, d.toISOString().split('T')[0], fields.tag_names, monthNames[d.getMonth()], fields.tagsColumn);
        res.status(200).send({});
    } catch (err) { console.error("Error Nth Day:", err.message); res.status(200).send({}); }
});

// AUTOMATION 2: X-Day of Next Month
app.post('/calculate-next-month-task', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inboundFieldValues || payload.inputFields;
        
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        nextMonth.setDate(parseInt(fields.day_of_month?.value || fields.day_of_month));
        
        await createMondayItem(fields.boardId, fields.groupId, fields.name, nextMonth.toISOString().split('T')[0], fields.tag_names, monthNames[nextMonth.getMonth()], fields.tagsColumn);
        res.status(200).send({});
    } catch (err) { console.error("Error Next Month:", err.message); res.status(200).send({}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server active on port ${PORT}`));
