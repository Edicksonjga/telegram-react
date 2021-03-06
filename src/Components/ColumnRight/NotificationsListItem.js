/*
 *  Copyright (c) 2018-present, Evgeny Nadymov
 *
 * This source code is licensed under the GPL v.3.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Typography from '@material-ui/core/Typography';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import Switch from '@material-ui/core/Switch';
import NotificationsIcon from '@material-ui/icons/Notifications';
import NotificationsActiveIcon from '@material-ui/icons/NotificationsActive';
import { withStyles } from '@material-ui/core/styles';
import NotificationsControl from '../ColumnMiddle/NotificationsControl';

const styles = {
    listItem: {
        padding: '11px 22px'
    }
};

class NotificationsListItem extends NotificationsControl {
    constructor(props){
        super(props);
    }

    render() {
        const { classes } = this.props;
        const { isMuted } = this.state;

        return (
            <ListItem button className={classes.listItem} onClick={this.handleSetChatNotifications}>
                <ListItemIcon>
                    {
                        !isMuted
                            ? <NotificationsActiveIcon/>
                            : <NotificationsIcon/>
                    }
                </ListItemIcon>
                <ListItemText primary={<Typography variant='inherit' noWrap>Notifications</Typography>}/>
                <ListItemSecondaryAction>
                    <Switch
                        color='primary'
                        onChange={this.handleSetChatNotifications}
                        checked={!isMuted}/>
                </ListItemSecondaryAction>
            </ListItem>
        );
    }
}

export default withStyles(styles)(NotificationsListItem);