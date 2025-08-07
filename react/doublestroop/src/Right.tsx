// Left.tsx
import React, { useState, useEffect } from 'react';
import tinycolor from 'tinycolor2';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableItem = ({ id, style }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: id });

    const itemStyle = {
        ...style,
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <li ref={setNodeRef} style={itemStyle} {...attributes} {...listeners}>
            {id}
        </li>
    );
};

const Left: React.FC = (props: any) => {
    const [startTime] = useState(new Date().getTime());
    const [message, setMessage] = useState('');
    const [items, setItems] = useState(props.gameData.hexCodesRight);

    const { hexCodesLeft, hexColorsLeft } = props.gameData;

    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

    const onDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.indexOf(active.id);
                const newIndex = items.indexOf(over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const checkAnswers = () => {
        let rightColors = items.map((code) => tinycolor(code).toHexString().toUpperCase());

        if (JSON.stringify(hexCodesLeft) === JSON.stringify(rightColors)) {
            let endTime = new Date().getTime();
            let timeTaken = (endTime - startTime) / 1000;
            setMessage(`Congratulations! You have solved the puzzle correctly. Time taken: ${timeTaken} seconds.`);
        } else {
            setMessage("Sorry, some of your answers are incorrect. Try again!");
        }
    };

    return (
        <div>
            <h1>Double Stroop Puzzle</h1>
            <h2>Match the hex codes on the left with the <i>colors</i> of the hex codes on the right</h2>
            <p id="message">{message}</p>
            <div>
                <div id="left-column">
                    {hexCodesLeft.map((code, index) => (
                        <p key={code} style={{ color: hexColorsLeft[index] }}>{code}</p>
                    ))}
                </div>
                <div id="right-column">
                    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
                        <SortableContext items={items} strategy={verticalListSortingStrategy}>
                            {items.map((code, index) => (
                                <SortableItem key={code} id={code} style={{ color: props.gameData.hexColorsRight[index] }} />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>
            <button onClick={checkAnswers}>Check Answers</button>
        </div>
    );
};

export default Left;

// Utility function to reorder the array based on drag and drop
const arrayMove = (array, from, to) => {
    const newArray = array.slice();
    newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
    return newArray;
};
