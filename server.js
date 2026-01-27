const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// --- 1. DROPDOWN OPTION ENDPOINTS ---
app.all('/get-nth-options', (req, res) => res.json([
    {title:"1st",value:"1"}, {title:"2nd",value:"2"}, {title:"3rd",value:"3"}, {title:"4th",value:"4"}
]));

app.all('/get-day-options', (req, res) => res.json([
    {title:"Monday",value:"1"}, {title:"Tuesday",value:"2"}, {title:"Wednesday",value:"3"}, {title:"Thursday",value:"4"}, {title:"Friday",value:"5"}, {title:"Saturday",value:"6"}, {title:"Sunday",value:"0"}
]));

// --- 2. ACTION 1: Nth DAY CALCULATION & OUTPUT ---
app.post('/calculate-task-on-nth-day', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inputFields || {};

        // Mapping inputs based on your screenshots
        const boardId = String(fields.boardId);
        const itemId = String(fields.item || fields.itemId); 
        const taskNameInput = fields.taskName || "New Task";

        console.log("--- Action 1: Processing ---");
        console.log(`Input Name: ${taskNameInput} | Input Item: ${itemId}`);

        // Date Calculation Logic
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        const dayToFind = parseInt(fields.day_of_week?.value || fields.day_of_week);
        const occurrence = parseInt(fields.nth_occurence?.value || fields.nth_occurence);

        while (d.getDay() !== dayToFind) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (occurrence - 1) * 7);
        const calculatedDate = d.toISOString().split('T')[0];

        // Sending values back to your new Output Keys
        res.status(200).send({ 
            outputFields: { 
                date: calculatedDate,             // Key: date
                statusColumnValues: monthNames[now.getMonth()], // Key: statusColumnValues
                taskName: taskNameInput,          // Key: taskName
                item: itemId,                     // Key: item
                itemId: itemId                    // Key: itemId
            } 
        });
    } catch (err) {
        console.error("Action 1 System Error:", err.message);
        res.status(200).send({}); 
    }
});

// --- 3. ACTION 2: SET DEADLINE (END OF MONTH) ---
app.post('/set-deadline', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inputFields || {};

        const boardId = String(fields.boardId);
        const itemId = String(fields.item || fields.itemId); 
        const dateCol = fields.dateColumnId; 

        console.log(`--- Action 2: Setting Deadline for ID ${itemId} ---`);

        if (!itemId || itemId === "undefined") {
            console.error("Action 2 Error: No Item ID found in mapping.");
            return res.status(200).send({});
        }

        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const formattedDate = lastDay.toISOString().split('T')[0];

        const query = `mutation ($board: ID!, $item: ID!, $values: JSON!) { 
            change_multiple_column_values (board_id: $board, item_id: $item, column_values: $values) { id } 
        }`;

        await axios.post('https://api.monday.com/v2', 
            { 
                query, 
                variables: { 
                    board: boardId, 
                    item: itemId, 
                    values: JSON.stringify({ [dateCol]: { "date": formattedDate } }) 
                } 
            }, 
            { headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'API-Version': '2025-04' 
            }}
        );

        res.status(200).send({});
    } catch (err) {
        console.error("Action 2 System Error:", err.message);
        res.status(200).send({}); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Multi-Action Server live on port ${PORT}`));
