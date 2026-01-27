const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

app.get('/', (req, res) => res.status(200).send("Server is live."));

// --- OPTION ENDPOINTS ---
app.all('/get-nth-options', (req, res) => res.json([
    {title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}
]));
app.all('/get-day-options', (req, res) => res.json([
    {title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}
]));

// --- ACTION 1: Nth Day Calculation ---
app.post('/calculate-task-on-nth-day', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inputFields || payload.inboundFieldValues || {};
        
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Match keys to Dev Center
        const dayToFind = parseInt(fields.day_of_week?.value || fields.day_of_week);
        const occurrence = parseInt(fields.nth_occurence?.value || fields.nth_occurence);

        if (isNaN(dayToFind) || isNaN(occurrence)) {
            throw new Error(`Invalid inputs: Day=${dayToFind}, Occur=${occurrence}`);
        }

        while (d.getDay() !== dayToFind) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (occurrence - 1) * 7);
        
        const calculatedDate = d.toISOString().split('T')[0];
        const currentMonth = monthNames[now.getMonth()];

        // Sending outputs for the recipe
        res.status(200).send({
            outputFields: {
                date: calculatedDate,   
                month_name: currentMonth 
            }
        });

    } catch (err) {
        console.error("Nth Day Error:", err.message);
        res.status(200).send({}); 
    }
});

// --- ACTION 2: Set Deadline (2025-04 API Unified) ---
app.post('/set-deadline', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inputFields || payload.inboundFieldValues || {};

        // Cast IDs to strings for strict API compliance
        const boardId = String(fields.boardId || payload.event?.boardId);
        const itemId = String(fields.itemId || payload.event?.pulseId);

        if (!boardId || !itemId || itemId === "undefined") throw new Error("Missing Board or Item ID");

        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        // Define Column Values using your specific Dev Center keys
        const columnValues = {
            [fields.dateColumnId]: { "date": lastDay.toISOString().split('T')[0] },
            [fields.statusColumnId]: { "label": monthNames[now.getMonth()] }
        };

        // API 2025-04 Strict Mutation Format
        const query = `mutation ($board: ID!, $item: ID!, $values: JSON!) { 
            change_multiple_column_values (
                board_id: $board, 
                item_id: $item, 
                column_values: $values,
                create_labels_if_missing: true
            ) { id } 
        }`;

        const variables = {
            board: boardId,
            item: itemId,
            values: JSON.stringify(columnValues)
        };

        const response = await axios.post('https://api.monday.com/v2', 
            { query, variables }, 
            { headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'API-Version': '2025-04',
                'Content-Type': 'application/json'
            }}
        );

        if (response.data.errors) {
            console.error("GraphQL Errors:", JSON.stringify(response.data.errors, null, 2));
        }

        res.status(200).send({});
    } catch (err) { 
        console.error("Deadline Error:", err.message); 
        res.status(200).send({}); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server live on port ${PORT}`));
