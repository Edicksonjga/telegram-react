/*
 *  Copyright (c) 2018-present, Evgeny Nadymov
 *
 * This source code is licensed under the GPL v.3.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import dateFormat from 'dateformat';
import Photo from '../Components/Message/Media/Photo';
import Video from '../Components/Message/Media/Video';
import Game from '../Components/Message/Media/Game';
import VideoNote from '../Components/Message/Media/VideoNote';
import Animation from '../Components/Message/Media/Animation';
import Sticker from '../Components/Message/Media/Sticker';
import Location from '../Components/Message/Media/Location';
import Venue from '../Components/Message/Media/Venue';
import Contact from '../Components/Message/Media/Contact';
import Document from '../Components/Message/Media/Document';
import Audio from '../Components/Message/Media/Audio';
import { getUserFullName } from './User';
import { getServiceMessageContent } from './ServiceMessage';
import { getAudioTitle } from './Media';
import { download, saveOrDownload } from './File';
import { getPhotoSize } from './Common';
import { LOCATION_HEIGHT, LOCATION_SCALE, LOCATION_WIDTH, LOCATION_ZOOM } from '../Constants';
import UserStore from '../Stores/UserStore';
import ChatStore from '../Stores/ChatStore';
import MessageStore from '../Stores/MessageStore';
import FileStore from '../Stores/FileStore';
import ApplicationStore from '../Stores/ApplicationStore';
import TdLibController from '../Controllers/TdLibController';

function getAuthor(message) {
    if (!message) return null;

    const { forward_info } = message;

    if (forward_info) {
        switch (forward_info['@type']) {
            case 'messageForwardedFromUser': {
                if (forward_info.sender_user_id > 0) {
                    const user = UserStore.get(forward_info.sender_user_id);
                    if (user) {
                        return getUserFullName(user);
                    }
                }
                break;
            }
            case 'messageForwardedPost': {
                const chat = ChatStore.get(forward_info.chat_id);
                if (chat) {
                    return chat.title;
                }
                break;
            }
        }
    }

    return getTitle(message);
}

function getTitle(message) {
    if (!message) return null;

    const { sender_user_id, chat_id } = message;

    if (sender_user_id) {
        const user = UserStore.get(sender_user_id);
        if (user) {
            return getUserFullName(user);
        }
    }

    if (chat_id) {
        const chat = ChatStore.get(chat_id);
        if (chat) {
            return chat.title;
        }
    }

    return null;
}

function substring(text, start, end) {
    if (start < 0) start = 0;
    if (start > text.length - 1) start = text.length - 1;
    if (end < start) end = start;
    if (end > text.length) end = text.length;

    return text.substring(start, end);
}

function getFormattedText(text) {
    if (text['@type'] !== 'formattedText') return null;
    if (!text.text) return null;
    if (!text.entities) return text.text;

    let result = [];
    let index = 0;
    for (let i = 0; i < text.entities.length; i++) {
        let beforeEntityText = substring(text.text, index, text.entities[i].offset);
        if (beforeEntityText) {
            result.push(beforeEntityText);
        }

        let entityText = substring(
            text.text,
            text.entities[i].offset,
            text.entities[i].offset + text.entities[i].length
        );
        switch (text.entities[i].type['@type']) {
            case 'textEntityTypeUrl': {
                let url = entityText.startsWith('http') ? entityText : 'http://' + entityText;
                let decodedUrl;
                try {
                    decodedUrl = decodeURI(entityText);
                } catch (error) {
                    console.error('uri: ' + entityText + '\n' + error);
                    decodedUrl = entityText;
                }

                result.push(
                    <a key={text.entities[i].offset} href={url} title={url} target='_blank' rel='noopener noreferrer'>
                        {decodedUrl}
                    </a>
                );
                break;
            }
            case 'textEntityTypeTextUrl': {
                let url = text.entities[i].type.url.startsWith('http')
                    ? text.entities[i].type.url
                    : 'http://' + text.entities[i].type.url;
                result.push(
                    <a key={text.entities[i].offset} href={url} title={url} target='_blank' rel='noopener noreferrer'>
                        {entityText}
                    </a>
                );
                break;
            }
            case 'textEntityTypeBold':
                result.push(<strong key={text.entities[i].offset}>{entityText}</strong>);
                break;
            case 'textEntityTypeItalic':
                result.push(<em key={text.entities[i].offset}>{entityText}</em>);
                break;
            case 'textEntityTypeCode':
                result.push(<code key={text.entities[i].offset}>{entityText}</code>);
                break;
            case 'textEntityTypePre':
                result.push(
                    <pre key={text.entities[i].offset}>
                        <code>{entityText}</code>
                    </pre>
                );
                break;
            case 'textEntityTypeMention':
                result.push(
                    <a key={text.entities[i].offset} href={`#/im?p=${entityText}`}>
                        {entityText}
                    </a>
                );
                break;
            case 'textEntityTypeMentionName':
                result.push(
                    <a key={text.entities[i].offset} href={`#/im?p=u${text.entities[i].type.user_id}`}>
                        {entityText}
                    </a>
                );
                break;
            case 'textEntityTypeHashtag':
                let hashtag = entityText.length > 0 && entityText[0] === '#' ? substring(entityText, 1) : entityText;
                result.push(
                    <a key={text.entities[i].offset} href={`tg://search_hashtag?hashtag=${hashtag}`}>
                        {entityText}
                    </a>
                );
                break;
            case 'textEntityTypeEmailAddress':
                result.push(
                    <a
                        key={text.entities[i].offset}
                        href={`mailto:${entityText}`}
                        target='_blank'
                        rel='noopener noreferrer'>
                        {entityText}
                    </a>
                );
                break;
            case 'textEntityTypeBotCommand':
                let command = entityText.length > 0 && entityText[0] === '/' ? substring(entityText, 1) : entityText;
                result.push(
                    <a key={text.entities[i].offset} href={`tg://bot_command?command=${command}&bot=`}>
                        {entityText}
                    </a>
                );
                break;
            default:
                result.push(entityText);
                break;
        }

        index += beforeEntityText.length + entityText.length;
    }

    if (index < text.text.length) {
        let afterEntityText = text.text.substring(index);
        if (afterEntityText) {
            result.push(afterEntityText);
        }
    }

    return result;
}

function getText(message) {
    if (!message) return null;

    let text = [];

    const { content } = message;

    if (
        content &&
        content['@type'] === 'messageText' &&
        content.text &&
        content.text['@type'] === 'formattedText' &&
        content.text.text
    ) {
        text = getFormattedText(content.text);
    } else {
        //text.push('[' + message.content['@type'] + ']');//JSON.stringify(x);
        if (content && content.caption && content.caption['@type'] === 'formattedText' && content.caption.text) {
            text.push('\n');
            let formattedText = getFormattedText(content.caption);
            if (formattedText) {
                text = text.concat(formattedText);
            }
        }
    }

    return text;
}

function getWebPage(message) {
    if (!message) return null;
    if (!message.content) return null;

    return message.content.web_page;
}

function getDate(message) {
    if (!message) return null;
    if (!message.date) return null;

    let date = new Date(message.date * 1000);

    return dateFormat(date, 'H:MM'); //date.toDateString();
}

function getDateHint(message) {
    if (!message) return null;
    if (!message.date) return null;

    const date = new Date(message.date * 1000);
    return dateFormat(date, 'H:MM:ss d.mm.yyyy'); //date.toDateString();
}

function getMedia(message, openMedia) {
    if (!message) return null;

    const { chat_id, id, content } = message;
    if (!content) return null;

    switch (content['@type']) {
        case 'messageText':
            return null;
        case 'messagePhoto':
            return <Photo chatId={chat_id} messageId={id} photo={content.photo} openMedia={openMedia} />;
        case 'messageVideo':
            return <Video chatId={chat_id} messageId={id} video={content.video} openMedia={openMedia} />;
        case 'messageVideoNote':
            return <VideoNote chatId={chat_id} messageId={id} videoNote={content.video_note} openMedia={openMedia} />;
        case 'messageAnimation':
            return <Animation chatId={chat_id} messageId={id} animation={content.animation} openMedia={openMedia} />;
        case 'messageGame':
            return <Game chatId={chat_id} messageId={id} game={content.game} openMedia={openMedia} />;
        case 'messageSticker':
            return <Sticker chatId={chat_id} messageId={id} sticker={content.sticker} openMedia={openMedia} />;
        case 'messageLocation':
            return <Location chatId={chat_id} messageId={id} location={content.location} openMedia={openMedia} />;
        case 'messageVenue':
            return <Venue chatId={chat_id} messageId={id} venue={content.venue} openMedia={openMedia} />;
        case 'messageContact':
            return <Contact chatId={chat_id} messageId={id} contact={content.contact} openMedia={openMedia} />;
        case 'messageAudio':
            return <Audio chatId={chat_id} messageId={id} audio={content.audio} openMedia={openMedia} />;
        case 'messageDocument':
            return <Document chatId={chat_id} messageId={id} document={content.document} openMedia={openMedia} />;
        default:
            return '[' + content['@type'] + ']';
    }
}

function getReply(message) {
    if (!message) return null;
    if (!message.reply_to_message_id) return null;

    return message.reply_to_message_id;
}

function getForward(message) {
    if (!message) return null;
    if (!message.forward_info) return null;

    switch (message.forward_info['@type']) {
        case 'messageForwardedFromUser': {
            let user = UserStore.get(message.forward_info.sender_user_id);
            if (user) {
                return getUserFullName(user);
            }
            break;
        }
        case 'messageForwardedPost': {
            let chat = ChatStore.get(message.forward_info.chat_id);
            if (chat) return chat.title;
            break;
        }
    }

    return null;
}

function getUnread(message) {
    if (!message) return false;
    if (!message.chat_id) return false;
    if (!message.is_outgoing) return false;

    let chat = ChatStore.get(message.chat_id);
    if (!chat) return false;

    return chat.last_read_outbox_message_id < message.id;
}

function getSenderUserId(message) {
    if (!message) return null;

    return message.sender_user_id;
}

function filterMessages(result, history) {
    if (result.messages.length === 0) return;
    if (history.length === 0) return;

    const map = history.reduce(function(accumulator, current) {
        accumulator.set(current.id, current.id);
        return accumulator;
    }, new Map());

    result.messages = result.messages.filter(x => !map.has(x.id));
}

function getContent(message, t = key => key) {
    if (!message) return null;

    const { content } = message;
    if (!content) return null;

    let caption = '';
    if (content.caption && content.caption.text) {
        caption = `, ${content.caption.text}`;
    }

    if (message.ttl > 0) {
        return getServiceMessageContent(message);
    }

    switch (content['@type']) {
        case 'messageAnimation': {
            return t('AttachGif') + caption;
        }
        case 'messageAudio': {
            return t('AttachMusic') + caption;
        }
        case 'messageBasicGroupChatCreate': {
            return getServiceMessageContent(message);
        }
        case 'messageCall': {
            return t('Call') + caption;
        }
        case 'messageChatAddMembers': {
            return getServiceMessageContent(message);
        }
        case 'messageChatChangePhoto': {
            return getServiceMessageContent(message);
        }
        case 'messageChatChangeTitle': {
            return getServiceMessageContent(message);
        }
        case 'messageChatDeleteMember': {
            return getServiceMessageContent(message);
        }
        case 'messageChatDeletePhoto': {
            return getServiceMessageContent(message);
        }
        case 'messageChatJoinByLink': {
            return getServiceMessageContent(message);
        }
        case 'messageChatSetTtl': {
            return getServiceMessageContent(message);
        }
        case 'messageChatUpgradeFrom': {
            return getServiceMessageContent(message);
        }
        case 'messageChatUpgradeTo': {
            return getServiceMessageContent(message);
        }
        case 'messageContact': {
            return t('AttachContact') + caption;
        }
        case 'messageContactRegistered': {
            return getServiceMessageContent(message);
        }
        case 'messageCustomServiceAction': {
            return getServiceMessageContent(message);
        }
        case 'messageDocument': {
            return t('AttachDocument') + caption;
        }
        case 'messageExpiredPhoto': {
            return t('AttachPhoto') + caption;
        }
        case 'messageExpiredVideo': {
            return t('AttachVideo') + caption;
        }
        case 'messageGame': {
            return t('AttachGame') + caption;
        }
        case 'messageGameScore': {
            return getServiceMessageContent(message);
        }
        case 'messageInvoice': {
            return getServiceMessageContent(message);
        }
        case 'messageLocation': {
            return t('AttachLocation') + caption;
        }
        case 'messagePassportDataReceived': {
            return getServiceMessageContent(message);
        }
        case 'messagePassportDataSent': {
            return getServiceMessageContent(message);
        }
        case 'messagePaymentSuccessful': {
            return getServiceMessageContent(message);
        }
        case 'messagePaymentSuccessfulBot': {
            return getServiceMessageContent(message);
        }
        case 'messagePhoto': {
            return t('AttachPhoto') + caption;
        }
        case 'messagePinMessage': {
            return getServiceMessageContent(message);
        }
        case 'messageScreenshotTaken': {
            return getServiceMessageContent(message);
        }
        case 'messageSticker': {
            return t('AttachSticker') + caption;
        }
        case 'messageSupergroupChatCreate': {
            return getServiceMessageContent(message);
        }
        case 'messageText': {
            return content.text.text + caption;
        }
        case 'messageUnsupported': {
            return getServiceMessageContent(message);
        }
        case 'messageVenue': {
            return t('AttachLocation') + caption;
        }
        case 'messageVideo': {
            return t('AttachVideo') + caption;
        }
        case 'messageVideoNote': {
            return t('AttachRound') + caption;
        }
        case 'messageVoiceNote': {
            return t('AttachAudio') + caption;
        }
        case 'messageWebsiteConnected': {
            return getServiceMessageContent(message);
        }
        default: {
            return t('UnsupportedAttachment');
        }
    }
}

function isMediaContent(content) {
    if (!content) return false;

    return content['@type'] === 'messagePhoto';
}

function getLocationId(location) {
    if (!location) return null;

    const { longitude, latitude } = location;
    return `loc=${latitude},${longitude}&size=${LOCATION_WIDTH},${LOCATION_HEIGHT}&scale=${LOCATION_SCALE}&zoom=${LOCATION_ZOOM}`;
}

function getVenueId(location) {
    if (!location) return null;

    const { longitude, latitude } = location;
    return `loc=${latitude},${longitude}&size=${LOCATION_WIDTH},${LOCATION_HEIGHT}&scale=${LOCATION_SCALE}&zoom=${LOCATION_ZOOM}`;
}

function isVideoMessage(chatId, messageId) {
    const message = MessageStore.get(chatId, messageId);
    if (!message) return false;

    const { content } = message;
    if (!content) return false;

    switch (content['@type']) {
        case 'messageVideo': {
            return true;
        }
        case 'messageText': {
            const { web_page } = content;
            return Boolean(web_page.video);
        }
        default: {
            return false;
        }
    }
}

function isAnimationMessage(chatId, messageId) {
    const message = MessageStore.get(chatId, messageId);
    if (!message) return false;

    const { content } = message;
    if (!content) return false;

    switch (content['@type']) {
        case 'messageAnimation': {
            return true;
        }
        case 'messageText': {
            const { web_page } = content;
            return Boolean(web_page.animation);
        }
        default: {
            return false;
        }
    }
}

function isContentOpened(chatId, messageId) {
    const message = MessageStore.get(chatId, messageId);
    if (!message) return true;

    const { content } = message;
    if (!content) return true;

    switch (content['@type']) {
        case 'messageVoiceNote': {
            return content.is_listened;
        }
        case 'messageVideoNote': {
            return content.is_viewed;
        }
        default: {
            return true;
        }
    }
}

function getMediaTitle(message) {
    if (!message) return null;

    const { content } = message;
    if (!content) return null;

    switch (content['@type']) {
        case 'messageAudio': {
            const { audio } = content;
            if (audio) {
                return getAudioTitle(audio);
            }
            break;
        }
        case 'messageText': {
            const { web_page } = content;
            if (web_page) {
                const { audio } = web_page;
                if (audio) {
                    return getAudioTitle(audio);
                }
                break;
            }
        }
    }

    return getAuthor(message);
}

function hasAudio(message) {
    if (!message) return false;

    const { content } = message;
    if (!content) return false;

    switch (content['@type']) {
        case 'messageAudio': {
            const { audio } = content;
            if (audio) {
                return true;
            }
            break;
        }
        case 'messageText': {
            const { web_page } = content;
            if (web_page) {
                const { audio } = web_page;
                if (audio) {
                    return true;
                }
                break;
            }
        }
    }

    return false;
}

function getSearchMessagesFilter(chatId, messageId) {
    const message = MessageStore.get(chatId, messageId);
    if (!message) return null;

    const { content } = message;
    if (!content) return null;

    switch (content['@type']) {
        case 'messageAudio': {
            const { audio } = content;
            if (audio) {
                return {
                    '@type': 'searchMessagesFilterAudio'
                };
            }
            break;
        }
        case 'messageVideoNote': {
            const { audio } = content;
            if (audio) {
                return {
                    '@type': 'searchMessagesFilterVideoNote'
                };
            }
            break;
        }
        case 'messageText': {
            const { web_page } = content;
            if (web_page) {
                const { audio, video_note } = web_page;
                if (audio) {
                    return {
                        '@type': 'searchMessagesFilterAudio'
                    };
                }
                if (video_note) {
                    return {
                        '@type': 'searchMessagesFilterVideoNote'
                    };
                }
                break;
            }
        }
    }

    return null;
}

function openMedia(chatId, messageId, onSelectUser) {
    const message = MessageStore.get(chatId, messageId);
    if (!message) return;

    const { content } = message;
    if (!content) return null;

    switch (content['@type']) {
        case 'messageContact': {
            const { contact } = content;
            if (contact) {
                if (onSelectUser) onSelectUser(contact.user_id);

                TdLibController.send({
                    '@type': 'openMessageContent',
                    chat_id: message.chat_id,
                    message_id: message.id
                });
            }
            break;
        }
        case 'messageDocument': {
            const { document } = content;
            if (document) {
                let file = document.document;
                if (file) {
                    file = FileStore.get(file.id) || file;
                    if (file.local.is_downloading_active) {
                        FileStore.cancelGetRemoteFile(file.id, message);
                    } else if (file.remote.is_uploading_active) {
                        FileStore.cancelUploadFile(file.id, message);
                    } else {
                        saveOrDownload(file, document.file_name, message, () => {
                            TdLibController.send({
                                '@type': 'openMessageContent',
                                chat_id: message.chat_id,
                                message_id: message.id
                            });
                        });
                    }
                }
            }

            break;
        }
        case 'messageAudio': {
            const { audio } = content;
            if (audio) {
                let file = audio.audio;
                if (file) {
                    file = FileStore.get(file.id) || file;
                    if (file.local.is_downloading_active) {
                        FileStore.cancelGetRemoteFile(file.id, message);
                        return;
                    } else if (file.remote.is_uploading_active) {
                        FileStore.cancelUploadFile(file.id, message);
                        return;
                    } else {
                        download(file, message);
                    }

                    TdLibController.send({
                        '@type': 'openMessageContent',
                        chat_id: message.chat_id,
                        message_id: message.id
                    });

                    // set active video note
                    TdLibController.clientUpdate({
                        '@type': 'clientUpdateMediaActive',
                        chatId: message.chat_id,
                        messageId: message.id
                    });
                }
            }

            break;
        }
        case 'messagePhoto': {
            const { photo } = message.content;
            if (photo) {
                const photoSize = getPhotoSize(photo.sizes);
                if (photoSize) {
                    let file = photoSize.photo;
                    if (file) {
                        file = FileStore.get(file.id);
                        if (file) {
                            if (file.local.is_downloading_active) {
                                FileStore.cancelGetRemoteFile(file.id, message);
                                return;
                            } else if (file.remote.is_uploading_active) {
                                FileStore.cancelUploadFile(file.id, message);
                                return;
                            } else {
                                download(file, message);
                            }
                        }
                    }
                }

                TdLibController.send({
                    '@type': 'openMessageContent',
                    chat_id: message.chat_id,
                    message_id: message.id
                });

                // open media viewer
                ApplicationStore.setMediaViewerContent({
                    chatId: chatId,
                    messageId: messageId
                });
            }

            break;
        }
        case 'messageGame': {
            const { game } = message.content;
            if (game) {
                const { animation } = game;
                if (animation) {
                    let file = animation.animation;
                    if (file) {
                        file = FileStore.get(file.id) || file;
                        if (file) {
                            if (file.local.is_downloading_active) {
                                FileStore.cancelGetRemoteFile(file.id, message);
                                return;
                            } else if (file.remote.is_uploading_active) {
                                FileStore.cancelUploadFile(file.id, message);
                                return;
                            } else {
                                download(file, message);
                            }
                        }
                    }
                }

                TdLibController.send({
                    '@type': 'openMessageContent',
                    chat_id: message.chat_id,
                    message_id: message.id
                });

                // set active animation
                TdLibController.clientUpdate({
                    '@type': 'clientUpdateActiveAnimation',
                    chatId: message.chat_id,
                    messageId: message.id
                });
            }

            break;
        }
        case 'messageText': {
            const { web_page } = message.content;
            if (web_page) {
                const { photo, animation, document, audio, video_note } = web_page;

                if (audio) {
                    let file = audio.audio;
                    if (file) {
                        file = FileStore.get(file.id) || file;
                        if (file.local.is_downloading_active) {
                            FileStore.cancelGetRemoteFile(file.id, message);
                            return;
                        } else if (file.remote.is_uploading_active) {
                            FileStore.cancelUploadFile(file.id, message);
                            return;
                        } else {
                            download(file, audio.file_name, message);
                        }

                        TdLibController.send({
                            '@type': 'openMessageContent',
                            chat_id: message.chat_id,
                            message_id: message.id
                        });

                        // set active video note
                        TdLibController.clientUpdate({
                            '@type': 'clientUpdateMediaActive',
                            chatId: message.chat_id,
                            messageId: message.id
                        });
                    }
                }

                if (video_note) {
                    let file = video_note.video;
                    if (file) {
                        file = FileStore.get(file.id) || file;
                        if (file) {
                            if (file.local.is_downloading_active) {
                                FileStore.cancelGetRemoteFile(file.id, message);
                                return;
                            } else if (file.remote.is_uploading_active) {
                                FileStore.cancelUploadFile(file.id, message);
                                return;
                            } else {
                                download(file, message);
                            }
                        }
                    }

                    TdLibController.send({
                        '@type': 'openMessageContent',
                        chat_id: message.chat_id,
                        message_id: message.id
                    });

                    // set active video note
                    TdLibController.clientUpdate({
                        '@type': 'clientUpdateMediaActive',
                        chatId: message.chat_id,
                        messageId: message.id
                    });
                }

                if (document) {
                    let file = document.document;
                    if (file) {
                        file = FileStore.get(file.id) || file;
                        if (file.local.is_downloading_active) {
                            FileStore.cancelGetRemoteFile(file.id, message);
                        } else if (file.remote.is_uploading_active) {
                            FileStore.cancelUploadFile(file.id, message);
                        } else {
                            saveOrDownload(file, document.file_name, message, () => {
                                TdLibController.send({
                                    '@type': 'openMessageContent',
                                    chat_id: message.chat_id,
                                    message_id: message.id
                                });
                            });
                        }
                    }
                }

                if (animation) {
                    let file = animation.animation;
                    if (file) {
                        file = FileStore.get(file.id) || file;
                        if (file) {
                            if (file.local.is_downloading_active) {
                                FileStore.cancelGetRemoteFile(file.id, message);
                                return;
                            } else if (file.remote.is_uploading_active) {
                                FileStore.cancelUploadFile(file.id, message);
                                return;
                            } else {
                                download(file, message);
                            }
                        }
                    }

                    TdLibController.clientUpdate({
                        '@type': 'clientUpdateActiveAnimation',
                        chatId: message.chat_id,
                        messageId: message.id
                    });

                    TdLibController.send({
                        '@type': 'openMessageContent',
                        chat_id: message.chat_id,
                        message_id: message.id
                    });

                    // open media viewer
                    ApplicationStore.setMediaViewerContent({
                        chatId: chatId,
                        messageId: messageId
                    });
                }

                if (photo) {
                    const photoSize = getPhotoSize(photo.sizes);
                    if (photoSize) {
                        let file = photoSize.photo;
                        if (file) {
                            file = FileStore.get(file.id) || file;
                            if (file) {
                                if (file.local.is_downloading_active) {
                                    FileStore.cancelGetRemoteFile(file.id, message);
                                    return;
                                } else if (file.remote.is_uploading_active) {
                                    FileStore.cancelUploadFile(file.id, message);
                                    return;
                                }
                                // else {
                                //     saveOrDownload(file, document.file_name, message);
                                // }
                            }
                        }
                    }

                    TdLibController.send({
                        '@type': 'openMessageContent',
                        chat_id: message.chat_id,
                        message_id: message.id
                    });

                    // open media viewer
                    ApplicationStore.setMediaViewerContent({
                        chatId: chatId,
                        messageId: messageId
                    });
                }
            }

            break;
        }
        case 'messageVideoNote': {
            const { video_note } = message.content;
            if (video_note) {
                let file = video_note.video;
                if (file) {
                    file = FileStore.get(file.id) || file;
                    if (file) {
                        if (file.local.is_downloading_active) {
                            FileStore.cancelGetRemoteFile(file.id, message);
                            return;
                        } else if (file.remote.is_uploading_active) {
                            FileStore.cancelUploadFile(file.id, message);
                            return;
                        } else {
                            download(file, message);
                        }
                    }
                }

                TdLibController.send({
                    '@type': 'openMessageContent',
                    chat_id: message.chat_id,
                    message_id: message.id
                });

                // set active video note
                TdLibController.clientUpdate({
                    '@type': 'clientUpdateMediaActive',
                    chatId: message.chat_id,
                    messageId: message.id
                });
            }

            break;
        }
        case 'messageAnimation': {
            const { animation } = message.content;
            if (animation) {
                let file = animation.animation;
                if (file) {
                    file = FileStore.get(file.id) || file;
                    if (file) {
                        if (file.local.is_downloading_active) {
                            FileStore.cancelGetRemoteFile(file.id, message);
                            return;
                        } else if (file.remote.is_uploading_active) {
                            FileStore.cancelUploadFile(file.id, message);
                            return;
                        } else {
                            download(file, message);
                        }
                    }
                }
            }

            // set active animation
            TdLibController.clientUpdate({
                '@type': 'clientUpdateActiveAnimation',
                chatId: message.chat_id,
                messageId: message.id
            });

            TdLibController.send({
                '@type': 'openMessageContent',
                chat_id: message.chat_id,
                message_id: message.id
            });

            // open media viewer
            ApplicationStore.setMediaViewerContent({
                chatId: chatId,
                messageId: messageId
            });

            break;
        }
        case 'messageVideo': {
            const { video } = message.content;
            if (video) {
                let file = video.video;
                if (file) {
                    file = FileStore.get(file.id) || file;
                    if (file) {
                        if (file.local.is_downloading_active) {
                            FileStore.cancelGetRemoteFile(file.id, message);
                            return;
                        } else if (file.remote.is_uploading_active) {
                            FileStore.cancelUploadFile(file.id, message);
                            return;
                        }
                        // else {
                        //     saveOrDownload(file, document.file_name, message);
                        // }
                    }
                }

                TdLibController.send({
                    '@type': 'openMessageContent',
                    chat_id: message.chat_id,
                    message_id: message.id
                });

                // open media viewer
                ApplicationStore.setMediaViewerContent({
                    chatId: chatId,
                    messageId: messageId
                });
            }

            break;
        }
    }
}

export {
    getAuthor,
    getTitle,
    getText,
    getFormattedText,
    getWebPage,
    getContent,
    getDate,
    getDateHint,
    getMedia,
    getReply,
    getForward,
    getUnread,
    getSenderUserId,
    filterMessages,
    isMediaContent,
    isVideoMessage,
    isAnimationMessage,
    getLocationId,
    getVenueId,
    isContentOpened,
    getMediaTitle,
    hasAudio,
    getSearchMessagesFilter,
    openMedia
};
