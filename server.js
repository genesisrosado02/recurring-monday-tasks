const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// OPTIONS FOR Nth DAY AND DAY OF WEEK
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));

// ACTION 1: CALCULATION & NAME UPDATE
app.post('/calculate-task-on-nth-day', async (req, res) => {
    try {
        const fields = req.body.payload.inputFields || {};
        const boardId = String(fields.boardId);
        const itemId = String(fields.item || fields.itemId); 
        const taskName = fields.taskName || "New Task"; // Matches your 'taskName' key

        if (!itemId || itemId === "undefined") {
            console.error("❌ Action 1: Missing Item ID mapping.");
            return res.status(200).send({});
        }

        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        const dayToFind = parseInt(fields.day_of_week?.value || fields.day_of_week);
        const occurrence = parseInt(fields.nth_occurence?.value || fields.nth_occurence);

        while (d.getDay() !== dayToFind) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (occurrence - 1) * 7);
        const calculatedDate = d.toISOString().split('T')[0];

        const query = `mutation ($board: ID!, $item: ID!, $values: JSON!, $name: String!) { 
            change_multiple_column_values (board_id: $board, item_id: $item, column_values: $values) { id }
            change_column_value (board_id: $board, item_id: $item, column_id: "name", value: $name) { id }
        }`;

        await axios.post('https://api.monday.com/v2', 
            { query, variables: { 
                board: boardId, 
                item: itemId, 
                values: JSON.stringify({
                    [fields.dateColumnId]: { "date": calculatedDate },
                    [fields.statusColumnId]: { "label": monthNames[now.getMonth()] }
                }),
                name: JSON.stringify(taskName) 
            }}, 
            { headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2025-04' }}
        );

        console.log(`✅ Action 1 Success: Updated ${taskName}`);
        res.status(200).send({ outputFields: { date: calculatedDate } });
    } catch (err) {
        console.error("Action 1 Error:", err.message);
        res.status(200).send({}); 
    }
});

// ACTION 2: SET DEADLINE (SECOND AUTOMATION)
app.post('/set-deadline', async (req, res) => {
    try {
        const fields = req.body.payload.inputFields || {};
        const itemId = String(fields.item || fields.itemId); 

        if (!itemId || itemId === "undefined") return res.status(200).send({});

        const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

        const query = `mutation ($board: ID!, $item: ID!, $values: JSON!) { 
            change_multiple_column_values (board_id: $board, item_id: $item, column_values: $values) { id } 
        }`;

        await axios.post('https://api.monday.com/v2', 
            { query, variables: { 
                board: String(fields.boardId), 
                item: itemId, 
                values: JSON.stringify({ [fields.dateColumnId]: { "date": lastDay } }) 
            }}, 
            { headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2025-04' }}
        );

        console.log(`✅ Action 2 Success: Deadline Set for ID ${itemId}`);
        res.status(200).send({});
    } catch (err) {
        console.error("Action 2 Error:", err.message);
        res.status(200).send({}); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
