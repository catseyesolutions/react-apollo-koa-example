// @flow
import { connect } from 'react-redux'
import { toggleTodo } from '../../ducks/todo'
import TodoList from '../../components/Todo/TodoList'

const mapStateToProps = (state: Object) => ({
  todos: state.todo.get('todos')
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onTodoClick(todoID) {
    dispatch(toggleTodo(todoID))
  }
})

const VisibleTodoList = connect(mapStateToProps, mapDispatchToProps)(TodoList)

export default VisibleTodoList
