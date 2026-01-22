const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => res.status(200).send("Server is live."));

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// --- OPTION ENDPOINTS ---
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));

// --- ACTION 1: Nth Day (Create New Item) ---
app.post('/calculate-task-on-nth-day', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inboundFieldValues || payload.inputFields || {};
        
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(fields.day_of_week?.value || fields.day_of_week)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(fields.nth_occurence?.value || fields.nth_occurence) - 1) * 7);
        
        const columnValues = {
            [fields.date_column || process.env.DUE_DATE_COLUMN_ID]: { "date": d.toISOString().split('T')[0] },
            [fields.client_column]: { "label": fields.client_name_value },
            [fields.month_column || process.env.MONTH_STATUS_COLUMN_ID]: { "label": monthNames[d.getMonth()] }
        };

        const query = `mutation { create_item (
            board_id: ${parseInt(fields.boardId)}, 
            group_id: "${fields.groupId}", 
            item_name: "${fields.name}", 
            create_labels_if_missing: true,
            column_values: ${JSON.stringify(JSON.stringify(columnValues))}
        ) { id } }`;

        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2024-01' } 
        });
        res.status(200).send({});
    } catch (err) { console.error("Nth Day Error:", err.message); res.status(200).send({}); }
});

// --- ACTION 2: Set Deadline (Update Existing Item) ---
app.post('/set-deadline', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inboundFieldValues || payload.inputFields || {};

        // FALLBACK LOGIC: Check manual fields first, then background event
        const boardId = fields.boardId || payload.event?.boardId;
        const itemId = fields.itemId || payload.event?.pulseId || payload.event?.itemId;

        console.log(`Update Request - Board: ${boardId}, Item: ${itemId}`);

        if (!boardId || !itemId) {
            console.log("Full Debug Payload:", JSON.stringify(payload));
            throw new Error(`Missing IDs - Board: ${boardId}, Item: ${itemId}`);
        }

        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const columnValues = {
            [fields.date_column || process.env.DUE_DATE_COLUMN_ID]: { "date": lastDay.toISOString().split('T')[0] },
            [fields.month_column || process.env.MONTH_STATUS_COLUMN_ID]: { "label": monthNames[now.getMonth()] }
        };

        const query = `mutation { change_multiple_column_values (
            board_id: ${parseInt(boardId)}, 
            item_id: ${parseInt(itemId)}, 
            create_labels_if_missing: true,
            column_values: ${JSON.stringify(JSON.stringify(columnValues))}
        ) { id } }`;

        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2024-01' } 
        });

        console.log(`Successfully updated item ${itemId}`);
        res.status(200).send({});
    } catch (err) { 
        console.error("Deadline Error:", err.message); 
        res.status(200).send({}); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server live on port ${PORT}`));
