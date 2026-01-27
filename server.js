const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

app.get('/', (req, res) => res.status(200).send("Server is live."));

// --- 1. OPTION ENDPOINTS ---
app.all('/get-nth-options', (req, res) => res.json([
    {title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}
]));

app.all('/get-day-options', (req, res) => res.json([
    {title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}
]));

// --- 2. ACTION 1: Nth Day Calculation & Update ---
// Use this endpoint for your primary calculation block
app.post('/calculate-task-on-nth-day', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inputFields || {};

        // Keys matched to your Dev Center
        const boardId = fields.boardId;
        const itemId = fields.itemId; 
        const dateCol = fields.dateColumnId; 
        const statusCol = fields.statusColumnId;

        if (!itemId || itemId === "undefined") {
            console.error("❌ Action 1 Error: No Item ID found.");
            return res.status(200).send({});
        }

        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        const dayToFind = parseInt(fields.day_of_week?.value || fields.day_of_week);
        const occurrence = parseInt(fields.nth_occurence?.value || fields.nth_occurence);

        while (d.getDay() !== dayToFind) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (occurrence - 1) * 7);
        
        const calculatedDate = d.toISOString().split('T')[0];
        const currentMonth = monthNames[now.getMonth()];

        // Push update to Monday
        const columnValues = JSON.stringify({
            [dateCol]: { "date": calculatedDate },
            [statusCol]: { "label": currentMonth }
        });

        const query = `mutation ($board: ID!, $item: ID!, $values: JSON!) { 
            change_multiple_column_values (board_id: $board, item_id: $item, column_values: $values, create_labels_if_missing: true) { id } 
        }`;

        await axios.post('https://api.monday.com/v2', 
            { query, variables: { board: String(boardId), item: String(itemId), values: columnValues } }, 
            { headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2025-04' }}
        );

        res.status(200).send({ outputFields: { date: calculatedDate, month_name: currentMonth } });
    } catch (err) {
        console.error("Action 1 System Error:", err.message);
        res.status(200).send({}); 
    }
});

// --- 3. ACTION 2: Set Deadline (Last Day of Month) ---
// Use this endpoint if you have a separate "Set Deadline" block
app.post('/set-deadline', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inputFields || {};

        const boardId = fields.boardId;
        const itemId = fields.itemId; 
        const dateCol = fields.dateColumnId; 

        if (!itemId || itemId === "undefined") {
            console.error("❌ Action 2 Error: No Item ID found.");
            return res.status(200).send({});
        }

        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const formattedDate = lastDay.toISOString().split('T')[0];

        const columnValues = JSON.stringify({
            [dateCol]: { "date": formattedDate }
        });

        const query = `mutation ($board: ID!, $item: ID!, $values: JSON!) { 
            change_multiple_column_values (board_id: $board, item_id: $item, column_values: $values) { id } 
        }`;

        await axios.post('https://api.monday.com/v2', 
            { query, variables: { board: String(boardId), item: String(itemId), values: columnValues } }, 
            { headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2025-04' }}
        );

        res.status(200).send({});
    } catch (err) {
        console.error("Action 2 System Error:", err.message);
        res.status(200).send({}); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Combined Server running on port ${PORT}`));
