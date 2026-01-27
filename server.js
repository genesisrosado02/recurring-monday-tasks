const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

app.post('/calculate-task-on-nth-day', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inputFields || {};

        // --- DEBUG LOGS: CHECK RENDER CONSOLE FOR THESE ---
        console.log("Full Fields Received:", JSON.js(fields));
        
        // Use the exact keys from your Dev Center screenshot
        const boardId = fields.boardId;
        const itemId = fields.itemId; // Exactly as seen in image_2fabe4.png
        const dateCol = fields.dateColumnId; // Exactly as seen in image_2f1940.png
        const statusCol = fields.statusColumnId;

        // Validation with better logging
        if (!itemId || !boardId) {
            console.error(`❌ ERROR: Missing IDs. Got itemId: ${itemId}, boardId: ${boardId}`);
            return res.status(200).send({}); 
        }

        // Calculation Logic
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        const dayToFind = parseInt(fields.day_of_week?.value || fields.day_of_week);
        const occurrence = parseInt(fields.nth_occurence?.value || fields.nth_occurence);

        while (d.getDay() !== dayToFind) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (occurrence - 1) * 7);
        
        const calculatedDate = d.toISOString().split('T')[0];
        const currentMonth = monthNames[now.getMonth()];

        // API 2025-04 UPDATE (This actually pushes the data to the board)
        const columnValues = JSON.stringify({
            [dateCol]: { "date": calculatedDate },
            [statusCol]: { "label": currentMonth }
        });

        const query = `mutation ($board: ID!, $item: ID!, $values: JSON!) { 
            change_multiple_column_values (
                board_id: $board, 
                item_id: $item, 
                column_values: $values,
                create_labels_if_missing: true
            ) { id } 
        }`;

        const response = await axios.post('https://api.monday.com/v2', 
            { query, variables: { board: String(boardId), item: String(itemId), values: columnValues } }, 
            { headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'API-Version': '2025-04' 
            }}
        );

        console.log("Monday API Response:", JSON.stringify(response.data));

        // Send outputs back so the Success window shows them
        res.status(200).send({
            outputFields: {
                date: calculatedDate,
                month_name: currentMonth
            }
        });

    } catch (err) {
        console.error("System Error:", err.message);
        res.status(200).send({}); 
    }
});

app.listen(process.env.PORT || 10000);
